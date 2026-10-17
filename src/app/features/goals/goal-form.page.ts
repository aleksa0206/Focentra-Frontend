import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { GoalDetail, GoalMode, GoalPeriod, GoalType } from '../../core/api/models';
import { GoalChanges, GoalInput, GoalsApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { LoadError } from '../../shared/ui/feedback';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';
import { applyServerErrors } from '../../shared/util/forms';
import { addDays, todayKey } from '../../shared/util/time';

const MAX_HOURS = 10_000;
const MAX_UNITS = 1_000_000;

/** Deadline on or after the start date (both `YYYY-MM-DD`, so text order is date order). */
const deadlineAfterStart: ValidatorFn = (group) => {
  const { mode, startDate, deadline } = group.getRawValue();
  if (mode === 'DEADLINE' && startDate && deadline && deadline < startDate) {
    group.get('deadline')!.setErrors({ order: 'The deadline cannot be before the start date.' });
  }
  return null;
};

@Component({
  selector: 'app-goal-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, FormField, FieldControl, LoadError],
  template: `
    <div class="page page--narrow">
      <app-page-header
        [title]="editing() ? 'Edit goal' : 'New goal'"
        [backLink]="editing() ? '/goals/' + id() : '/goals'"
        [backLabel]="editing() ? 'Goal' : 'Goals'"
      />

      @if (existing.error(); as error) {
        <app-load-error [error]="error" (retry)="existing.reload()" />
      } @else {
        <form class="form panel panel__body" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (error(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }

          <app-field label="Name">
            <input
              class="input"
              appFieldControl
              formControlName="name"
              placeholder="e.g. Learn Angular"
            />
          </app-field>

          <fieldset class="choice" [disabled]="editing()">
            <legend>Measured in</legend>
            <label class="checkbox">
              <input type="radio" formControlName="type" value="TIME" />
              Hours, from the timer
            </label>
            <label class="checkbox">
              <input type="radio" formControlName="type" value="COUNT" />
              Units you log yourself (pages, tasks, km)
            </label>
          </fieldset>

          <div class="form__row">
            @if (type() === 'COUNT') {
              <app-field label="Unit" hint="Plural, e.g. pages.">
                <input class="input" appFieldControl formControlName="unit" maxlength="20" />
              </app-field>
            }
            <app-field
              [label]="type() === 'TIME' ? 'Target (hours)' : 'Target'"
              [hint]="type() === 'TIME' ? 'Decimals are fine, e.g. 7.5.' : ''"
            >
              <input
                class="input"
                appFieldControl
                type="number"
                formControlName="target"
                min="0"
                [step]="type() === 'TIME' ? 0.5 : 1"
                inputmode="decimal"
              />
            </app-field>
          </div>

          <fieldset class="choice" [disabled]="editing()">
            <legend>Schedule</legend>
            <label class="checkbox">
              <input type="radio" formControlName="mode" value="DEADLINE" />
              Reach it by a deadline
            </label>
            <label class="checkbox">
              <input type="radio" formControlName="mode" value="RECURRING" />
              Reach it again every week or month
            </label>
          </fieldset>

          <div class="form__row">
            @if (mode() === 'RECURRING') {
              <app-field label="Every">
                <select class="select" appFieldControl formControlName="period">
                  <option value="WEEKLY">Week (Monday to Sunday)</option>
                  <option value="MONTHLY">Month</option>
                </select>
              </app-field>
            }
            <app-field label="Start date">
              <input class="input" appFieldControl type="date" formControlName="startDate" />
            </app-field>
            @if (mode() === 'DEADLINE') {
              <app-field label="Deadline" hint="Included: the goal ends at the end of this day.">
                <input class="input" appFieldControl type="date" formControlName="deadline" />
              </app-field>
            }
          </div>

          @if (editing()) {
            <p class="text-meta">
              What a goal measures and its schedule are fixed. Changing the target keeps past weeks
              or months judged against the target they had.
            </p>
          }

          <div class="form__actions">
            <button
              type="submit"
              class="btn btn--primary"
              [disabled]="submitting()"
              [attr.aria-busy]="submitting()"
            >
              @if (submitting()) {
                <span class="spinner" aria-hidden="true"></span>
              }
              {{ editing() ? 'Save changes' : 'Create goal' }}
            </button>
            <button type="button" class="btn btn--ghost" (click)="cancel()">Cancel</button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .choice {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      border: 0;

      legend {
        margin-bottom: var(--space-2);
        font-size: var(--font-size-secondary);
        font-weight: var(--font-weight-medium);
      }
      &:disabled {
        opacity: 0.6;
      }
    }
  `,
})
export default class GoalFormPage {
  private readonly api = inject(GoalsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  /** Route parameter; set when editing. */
  readonly id = input<string>();
  protected readonly editing = computed(() => this.id() !== undefined);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      name: ['', [Validators.required, Validators.maxLength(100)]],
      type: ['TIME' as GoalType],
      unit: ['pages', [Validators.required, Validators.maxLength(20)]],
      target: [10, [Validators.required, Validators.min(0.1)]],
      mode: ['DEADLINE' as GoalMode],
      period: ['WEEKLY' as GoalPeriod],
      startDate: [todayKey(this.auth.timeZone()), Validators.required],
      deadline: [addDays(todayKey(this.auth.timeZone()), 30), Validators.required],
    },
    { validators: deadlineAfterStart },
  );

  protected readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  protected readonly mode = toSignal(this.form.controls.mode.valueChanges, {
    initialValue: this.form.controls.mode.value,
  });

  protected readonly existing = rxResource({
    params: () => this.id(),
    stream: ({ params }) => (params ? this.api.get(Number(params)) : of(null)),
  });

  constructor() {
    effect(() => {
      const goal = this.existing.value();
      if (goal) {
        this.fill(goal);
      }
    });
    // Units can be counted only in whole numbers; hours in halves and the like.
    effect(() => {
      const target = this.form.controls.target;
      target.setValidators([
        Validators.required,
        Validators.min(this.type() === 'TIME' ? 0.1 : 1),
        Validators.max(this.type() === 'TIME' ? MAX_HOURS : MAX_UNITS),
      ]);
      target.updateValueAndValidity({ emitEvent: false });
      this.toggle('unit', this.type() === 'COUNT');
    });
    effect(() => {
      this.toggle('deadline', this.mode() === 'DEADLINE');
    });
  }

  private toggle(name: 'unit' | 'deadline', enabled: boolean): void {
    const control = this.form.controls[name];
    if (enabled) {
      control.enable({ emitEvent: false });
    } else {
      control.disable({ emitEvent: false });
    }
  }

  private fill(goal: GoalDetail): void {
    this.form.reset({
      name: goal.name,
      type: goal.type,
      unit: goal.unit ?? 'pages',
      target: goal.type === 'TIME' ? goal.target / 3600 : goal.target,
      mode: goal.mode,
      period: goal.period ?? 'WEEKLY',
      startDate: goal.startDate,
      deadline: goal.deadline ?? addDays(goal.startDate, 30),
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const target =
      value.type === 'TIME' ? Math.round(value.target * 3600) : Math.round(value.target);

    this.submitting.set(true);
    this.error.set(null);
    const id = this.id();
    const request = id
      ? this.api.update(Number(id), {
          name: value.name,
          target,
          startDate: value.startDate,
          ...(value.type === 'COUNT' && { unit: value.unit }),
          ...(value.mode === 'DEADLINE' && { deadline: value.deadline }),
        } satisfies GoalChanges)
      : this.api.create({
          name: value.name,
          type: value.type,
          mode: value.mode,
          target,
          startDate: value.startDate,
          ...(value.type === 'COUNT' && { unit: value.unit }),
          ...(value.mode === 'DEADLINE' ? { deadline: value.deadline } : { period: value.period }),
        } satisfies GoalInput);

    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (goal) => {
        this.toast.success(id ? 'Goal saved.' : 'Goal created.');
        void this.router.navigate(['/goals', goal.id]);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        if (!applyServerErrors(this.form, apiError)) {
          this.error.set(apiError.message);
        }
      },
    });
  }

  protected cancel(): void {
    const id = this.id();
    void this.router.navigate(id ? ['/goals', id] : ['/goals']);
  }
}
