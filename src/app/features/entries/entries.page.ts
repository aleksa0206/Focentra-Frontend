import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { DateKey, OwnTimeEntry, TimeEntry } from '../../core/api/models';
import { GoalsApi, TimeEntriesApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { TimerService } from '../../core/timer.service';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { FormDialogService } from '../../shared/ui/dialogs';
import { EmptyState, LoadError, SkeletonRows } from '../../shared/ui/feedback';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { ToastService } from '../../shared/ui/toast';
import { goalColor } from '../../shared/util/goal-format';
import {
  addDays,
  dateKeyIn,
  dayLabel,
  durationText,
  timeOfDay,
  todayKey,
  weekdayOf,
} from '../../shared/util/time';
import { EntryDialog, EntryDialogData } from './entry-dialog';

type Range = 'week' | '7d' | 'month' | 'all';
const RANGES: { id: Range; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: '7d', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All' },
];

@Component({
  selector: 'app-entries-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, EmptyState, LoadError, SkeletonRows, Icon, Pagination],
  template: `
    <div class="page">
      <app-page-header
        title="Time log"
        description="Everything you tracked. Forgot the timer? Add the time here."
      >
        <button type="button" class="btn btn--primary" (click)="add()">
          <app-icon name="plus" />
          Add time
        </button>
      </app-page-header>

      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Period">
          @for (r of ranges; track r.id) {
            <button
              type="button"
              [attr.aria-pressed]="currentRange() === r.id"
              (click)="go({ range: r.id, page: null })"
            >
              {{ r.label }}
            </button>
          }
        </div>
        <label class="toolbar__filter">
          <span class="text-secondary">Goal</span>
          <select
            class="select"
            [value]="goal() ?? ''"
            (change)="go({ goal: $any($event.target).value || null, page: null })"
          >
            <option value="">All goals</option>
            @for (g of timeGoals(); track g.id) {
              <option [value]="g.id">{{ g.name }}</option>
            }
          </select>
        </label>
        <span class="toolbar__spacer"></span>
        @if (total(); as t) {
          <span class="text-secondary"
            >Total on this page: <strong>{{ t }}</strong></span
          >
        }
      </div>

      @if (entries.error(); as error) {
        <app-load-error [error]="error" (retry)="entries.reload()" />
      } @else if (entries.value()?.data?.length === 0) {
        <div class="panel">
          <app-empty-state
            icon="clock"
            title="No time in this period"
            description="Start the timer in the top bar, or add time you forgot to track."
          >
            <button type="button" class="btn" (click)="add()">Add time</button>
          </app-empty-state>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="table table--stack">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Time</th>
                <th scope="col" class="num">Duration</th>
                <th scope="col">Goal</th>
                <th scope="col">Note</th>
                <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            @if (entries.value(); as page) {
              <tbody>
                @for (e of page.data; track e.id) {
                  <tr>
                    <td data-label="Day" data-primary>{{ day(e) }}</td>
                    <td data-label="Time">{{ span(e) }}</td>
                    <td data-label="Duration" class="num">
                      @if (e.running) {
                        <span class="badge badge--info">running</span>
                      } @else {
                        {{ duration(e.durationSeconds) }}
                      }
                    </td>
                    <td data-label="Goal">
                      @if (e.goal; as g) {
                        <a
                          class="goal-dot"
                          [style.--goal-color]="color(g.id)"
                          [routerLink]="['/goals', g.id]"
                          >{{ g.name }}</a
                        >
                      } @else {
                        <span class="text-meta">No goal</span>
                      }
                    </td>
                    <td data-label="Note" class="truncate">{{ e.note }}</td>
                    <td class="actions">
                      <button type="button" class="btn btn--ghost btn--sm" (click)="edit(e)">
                        Edit
                      </button>
                      @if (!e.running) {
                        <button type="button" class="btn btn--ghost btn--sm" (click)="remove(e)">
                          Delete
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            } @else {
              <tbody appSkeletonRows columns="6"></tbody>
            }
          </table>
        </div>
        <app-pagination [meta]="entries.value()?.meta" (pageChange)="go({ page: $event })" />
      }
    </div>
  `,
})
export default class EntriesPage {
  private readonly api = inject(TimeEntriesApi);
  private readonly goalsApi = inject(GoalsApi);
  private readonly auth = inject(AuthService);
  private readonly timer = inject(TimerService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(FormDialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  // List state lives in the URL (?range=month&goal=3&page=2).
  readonly range = input<string>();
  readonly goal = input<string>();
  readonly page = input<string>();

  protected readonly ranges = RANGES;
  protected readonly color = goalColor;
  protected readonly duration = durationText;
  protected readonly currentRange = computed<Range>(() =>
    RANGES.some((r) => r.id === this.range()) ? (this.range() as Range) : 'week',
  );

  private readonly allGoals = rxResource({
    stream: () => this.goalsApi.list('active'),
  });
  private readonly archivedGoals = rxResource({
    stream: () => this.goalsApi.list('archived'),
  });
  protected readonly timeGoals = computed(() =>
    [...(this.allGoals.value() ?? []), ...(this.archivedGoals.value() ?? [])].filter(
      (g) => g.type === 'TIME',
    ),
  );

  private readonly dates = computed((): { from?: DateKey; to?: DateKey } => {
    const today = todayKey(this.auth.timeZone());
    switch (this.currentRange()) {
      case 'week':
        return { from: addDays(today, -weekdayOf(today)), to: today };
      case '7d':
        return { from: addDays(today, -6), to: today };
      case 'month':
        return { from: `${today.slice(0, 8)}01`, to: today };
      case 'all':
        return {};
    }
  });

  protected readonly entries = rxResource({
    params: () => ({
      ...this.dates(),
      goalId: this.goal() ? Number(this.goal()) : undefined,
      page: Number(this.page()) || 1,
      limit: 25,
      changes: this.timer.changes(),
    }),
    stream: ({ params }) => {
      const { changes: _changes, ...query } = params;
      return this.api.list(query);
    },
  });

  protected readonly total = computed(() => {
    const data = this.entries.value()?.data ?? [];
    return data.length ? durationText(data.reduce((sum, e) => sum + e.durationSeconds, 0)) : '';
  });

  protected day(entry: TimeEntry): string {
    return dayLabel(dateKeyIn(entry.startedAt, this.auth.timeZone()));
  }

  protected span(entry: TimeEntry): string {
    const zone = this.auth.timeZone();
    const start = timeOfDay(entry.startedAt, zone);
    if (!entry.endedAt) return `${start} – now`;
    const crosses = dateKeyIn(entry.endedAt, zone) !== dateKeyIn(entry.startedAt, zone);
    return `${start} – ${timeOfDay(entry.endedAt, zone)}${crosses ? ' (+1 day)' : ''}`;
  }

  protected go(params: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }

  protected async add(): Promise<void> {
    await this.openDialog(null);
  }

  protected async edit(entry: OwnTimeEntry): Promise<void> {
    await this.openDialog(entry);
  }

  private async openDialog(entry: TimeEntry | null): Promise<void> {
    const saved = await this.dialogs.open<TimeEntry, EntryDialogData>(
      EntryDialog,
      { entry, goals: this.timeGoals(), timeZone: this.auth.timeZone() },
      'entry-dialog-title',
    );
    if (saved) {
      this.toast.success(entry ? 'Entry saved.' : `Added ${durationText(saved.durationSeconds)}.`);
      this.entries.reload();
      if (saved.running) {
        this.timer.refresh();
      }
    }
  }

  protected async remove(entry: OwnTimeEntry): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete this entry?',
      message: `${durationText(entry.durationSeconds)} on ${this.day(entry)} will be removed${entry.goal ? ` from "${entry.goal.name}"` : ''}.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.api.remove(entry.id).subscribe({
      next: () => {
        this.toast.success('Entry deleted.');
        this.entries.reload();
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
