import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, Observable } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { GoalDetail, Paged } from '../../core/api/models';
import { GoalsApi, ProgressEntriesApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { TimerService } from '../../core/timer.service';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { EmptyState, LoadError } from '../../shared/ui/feedback';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { Pagination } from '../../shared/ui/pagination';
import { ToastService } from '../../shared/ui/toast';
import { applyServerErrors } from '../../shared/util/forms';
import { goalValueText } from '../../shared/util/goal-format';
import { dateTimeLabel, dayLabel, durationText, todayKey } from '../../shared/util/time';

interface Row {
  id: number;
  who: string;
  mine: boolean;
  when: string;
  amount: string;
  note: string | null;
  running: boolean;
}

/** Everything logged on the goal by every member, plus the form to log units (COUNT goals). */
@Component({
  selector: 'app-goal-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormField, FieldControl, EmptyState, LoadError, Pagination],
  template: `
    @if (goal().type === 'COUNT' && !goal().archived) {
      <section class="panel" id="log" aria-labelledby="log-title">
        <div class="panel__header">
          <h2 class="panel__title" id="log-title">Log progress</h2>
        </div>
        <form class="panel__body log-form" [formGroup]="form" (ngSubmit)="add()" novalidate>
          @if (formError(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }
          <app-field [label]="'Amount (' + goal().unit + ')'">
            <input
              class="input"
              appFieldControl
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              formControlName="amount"
            />
          </app-field>
          <app-field label="Day">
            <input
              class="input"
              appFieldControl
              type="date"
              formControlName="occurredOn"
              [max]="today()"
            />
          </app-field>
          <app-field label="Note" [optional]="true">
            <input class="input" appFieldControl formControlName="note" maxlength="500" />
          </app-field>
          <button
            type="submit"
            class="btn btn--primary"
            [disabled]="saving()"
            [attr.aria-busy]="saving()"
          >
            Add
          </button>
        </form>
      </section>
    }

    <section class="panel" aria-labelledby="entries-title">
      <div class="panel__header">
        <h2 class="panel__title" id="entries-title">
          {{ goal().type === 'TIME' ? 'Time entries' : 'Logged progress' }}
        </h2>
      </div>
      @if (rows.error(); as error) {
        <app-load-error [error]="error" (retry)="rows.reload()" />
      } @else if (rows.value(); as page) {
        @if (page.data.length === 0) {
          <app-empty-state
            icon="inbox"
            title="Nothing logged yet"
            [description]="
              goal().type === 'TIME'
                ? 'Start the timer on this goal, or add past time in the time log.'
                : 'Log what you have done above.'
            "
          />
        } @else {
          <div class="table-wrap table-wrap--flush">
            <table class="table table--stack">
              <thead>
                <tr>
                  @if (shared()) {
                    <th scope="col">Who</th>
                  }
                  <th scope="col">When</th>
                  <th scope="col" class="num">{{ goal().type === 'TIME' ? 'Time' : 'Amount' }}</th>
                  <th scope="col">Note</th>
                  <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of page.data; track row.id) {
                  <tr>
                    @if (shared()) {
                      <td data-label="Who" data-primary>{{ row.who }}</td>
                    }
                    <td data-label="When">{{ row.when }}</td>
                    <td data-label="Amount" class="num">
                      {{ row.amount }}
                      @if (row.running) {
                        <span class="badge badge--info">running</span>
                      }
                    </td>
                    <td data-label="Note" class="truncate">{{ row.note }}</td>
                    <td class="actions">
                      @if (row.mine && goal().type === 'COUNT') {
                        <button type="button" class="btn btn--ghost btn--sm" (click)="remove(row)">
                          Delete
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="panel__footer">
            <app-pagination [meta]="page.meta" (pageChange)="page_.set($event)" />
          </div>
        }
      } @else {
        <div class="panel__body"><span class="skeleton" style="width: 50%"></span></div>
      }
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }
    .log-form {
      display: grid;
      grid-template-columns: 140px 170px 1fr auto;
      align-items: end;
      gap: var(--space-3);
      @media (max-width: 720px) {
        grid-template-columns: 1fr 1fr;
      }
      .form-error {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class GoalLog {
  readonly goal = input.required<GoalDetail>();
  /** Something was logged or deleted; the parent reloads the progress. */
  readonly changed = output<void>();

  private readonly goalsApi = inject(GoalsApi);
  private readonly progressApi = inject(ProgressEntriesApi);
  private readonly auth = inject(AuthService);
  private readonly timer = inject(TimerService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly page_ = signal(1);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly shared = computed(() => this.goal().memberCount > 1);
  protected readonly today = computed(() => todayKey(this.goal().timezone));

  protected readonly form = inject(NonNullableFormBuilder).group({
    amount: [1, [Validators.required, Validators.min(1), Validators.max(1_000_000)]],
    occurredOn: [todayKey(this.auth.timeZone()), Validators.required],
    note: ['', Validators.maxLength(500)],
  });

  protected readonly rows = rxResource({
    params: () => ({
      goal: this.goal(),
      page: this.page_(),
      changes: this.timer.changes(),
    }),
    stream: ({ params }): Observable<Paged<Row>> => {
      const { goal, page } = params;
      const me = this.auth.user()?.id;
      const zone = this.auth.timeZone();
      if (goal.type === 'TIME') {
        return this.goalsApi.timeEntries(goal.id, { page, limit: 20 }).pipe(
          map((res) => ({
            meta: res.meta,
            data: res.data.map((e) => ({
              id: e.id,
              who: e.user.name,
              mine: e.user.id === me,
              when: dateTimeLabel(e.startedAt, zone),
              amount: durationText(e.durationSeconds),
              note: e.note,
              running: e.running,
            })),
          })),
        );
      }
      return this.goalsApi.progressEntries(goal.id, { page, limit: 20 }).pipe(
        map((res) => ({
          meta: res.meta,
          data: res.data.map((e) => ({
            id: e.id,
            who: e.user.name,
            mine: e.user.id === me,
            when: dayLabel(e.occurredOn),
            amount: goalValueText(goal, e.amount),
            note: e.note,
            running: false,
          })),
        })),
      );
    },
  });

  protected add(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { amount, occurredOn, note } = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.goalsApi
      .addProgress(this.goal().id, { amount, occurredOn, note: note.trim() || null })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(`Logged ${goalValueText(this.goal(), amount)}.`);
          this.form.reset({ amount: 1, occurredOn: this.today(), note: '' });
          this.rows.reload();
          this.changed.emit();
        },
        error: (err: unknown) => {
          const apiError = toApiError(err);
          if (!applyServerErrors(this.form, apiError)) {
            this.formError.set(apiError.message);
          }
        },
      });
  }

  protected async remove(row: Row): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete this entry?',
      message: `${row.amount} on ${row.when} will no longer count toward the goal.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.progressApi.remove(row.id).subscribe({
      next: () => {
        this.rows.reload();
        this.changed.emit();
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
