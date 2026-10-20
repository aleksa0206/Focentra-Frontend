import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Goal, TimeEntry } from '../../core/api/models';
import { TimeEntriesApi } from '../../core/api/resources';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import {
  addDays,
  dateKeyIn,
  durationText,
  timeOfDay,
  todayKey,
  zonedInstant,
  dateTimeLabel,
} from '../../shared/util/time';

export interface EntryDialogData {
  entry: TimeEntry | null;
  goals: Goal[];
  timeZone: string;
}

const MAX_SECONDS = 24 * 3600;

/**
 * Add or edit a past entry. Times are entered as wall-clock times in the user's zone; an end time
 * earlier than the start means the session went past midnight (23:00 to 01:00).
 */
@Component({
  selector: 'app-entry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormField, FieldControl],
  host: { class: 'dialog' },
  template: `
    <h2 class="dialog__title" id="entry-dialog-title">
      {{ data.entry ? (running ? 'Edit running entry' : 'Edit entry') : 'Add time' }}
    </h2>
    <form class="dialog__form" [formGroup]="form" (ngSubmit)="save()" novalidate>
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
      <app-field label="Day">
        <input class="input" appFieldControl type="date" formControlName="date" [max]="today" />
      </app-field>
      <div class="form__row">
        <app-field label="From">
          <input class="input" appFieldControl type="time" formControlName="start" />
        </app-field>
        @if (!running) {
          <app-field label="To">
            <input class="input" appFieldControl type="time" formControlName="end" />
          </app-field>
        }
      </div>
      @if (!running) {
        <p class="text-meta" aria-live="polite">{{ durationHint() }}</p>
      }
      <app-field label="Goal" [optional]="true">
        <select class="select" appFieldControl formControlName="goalId">
          <option [ngValue]="null">No goal</option>
          @for (goal of timeGoals; track goal.id) {
            <option [ngValue]="goal.id">{{ goal.name }}</option>
          }
        </select>
      </app-field>
      <app-field label="Note" [optional]="true">
        <input class="input" appFieldControl formControlName="note" maxlength="500" />
      </app-field>
      <div class="dialog__actions">
        <button type="button" class="btn" (click)="ref.close()">Cancel</button>
        <button
          type="submit"
          class="btn btn--primary"
          [disabled]="saving()"
          [attr.aria-busy]="saving()"
        >
          Save
        </button>
      </div>
    </form>
  `,
})
export class EntryDialog {
  protected readonly data = inject<EntryDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<TimeEntry>>(DialogRef);
  private readonly api = inject(TimeEntriesApi);

  protected readonly running = this.data.entry?.running ?? false;
  protected readonly today = todayKey(this.data.timeZone);
  // Archived goals can't take new time; the entry's own goal stays selectable when editing.
  protected readonly timeGoals = this.data.goals.filter(
    (g) => g.type === 'TIME' && (!g.archived || g.id === this.data.entry?.goalId),
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    date: [this.initialDate(), Validators.required],
    start: [this.initialTime('start'), Validators.required],
    end: [this.initialTime('end'), Validators.required],
    goalId: [this.data.entry?.goalId ?? (null as number | null)],
    note: [this.data.entry?.note ?? '', Validators.maxLength(500)],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  private interval(): { start: Date; end: Date } | null {
    const { date, start, end } = this.form.getRawValue();
    if (!date || !start || !end) return null;
    const from = zonedInstant(date, start, this.data.timeZone);
    let to = zonedInstant(date, end, this.data.timeZone);
    if (to <= from) {
      to = zonedInstant(addDays(date, 1), end, this.data.timeZone);
    }
    return { start: from, end: to };
  }

  protected readonly durationHint = computed(() => {
    this.value();
    const interval = this.interval();
    if (!interval) return '';
    const seconds = (interval.end.getTime() - interval.start.getTime()) / 1000;
    const nextDay = dateKeyIn(interval.end, this.data.timeZone) !== this.form.getRawValue().date;
    return `${durationText(seconds)}${nextDay ? ', ending the next day' : ''}`;
  });

  constructor() {
    if (this.running) {
      this.form.controls.end.disable();
    }
  }

  private initialDate(): string {
    const entry = this.data.entry;
    return entry ? dateKeyIn(entry.startedAt, this.data.timeZone) : todayKey(this.data.timeZone);
  }

  private initialTime(which: 'start' | 'end'): string {
    const entry = this.data.entry;
    if (entry) {
      const instant = which === 'start' ? entry.startedAt : entry.endedAt;
      return instant ? timeOfDay(instant, this.data.timeZone) : '';
    }
    // A new entry defaults to the hour that just ended.
    const now = new Date();
    const hour = new Date(now.getTime() - (which === 'start' ? 3600_000 : 0));
    return timeOfDay(hour, this.data.timeZone);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { date, start, goalId, note } = this.form.getRawValue();
    const startedAt = zonedInstant(date, start, this.data.timeZone);
    const interval = this.running ? null : this.interval()!;
    if (interval) {
      const seconds = (interval.end.getTime() - interval.start.getTime()) / 1000;
      if (seconds > MAX_SECONDS) {
        this.error.set('An entry can be at most 24 hours long.');
        return;
      }
      if (interval.end.getTime() > Date.now() + 60_000) {
        this.error.set('The entry cannot end in the future.');
        return;
      }
    }

    const body = {
      startedAt: startedAt.toISOString(),
      ...(interval && { endedAt: interval.end.toISOString() }),
      goalId,
      note: note.trim() || null,
    };
    const entry = this.data.entry;
    const request = entry
      ? this.api.update(entry.id, body)
      : this.api.create({ ...body, endedAt: interval!.end.toISOString() });

    this.saving.set(true);
    this.error.set(null);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.ref.close(saved),
      error: (err: unknown) => {
        const apiError = toApiError(err);
        const other = apiError.body['overlapping'] as TimeEntry | undefined;
        this.error.set(
          apiError.code === 'ENTRY_OVERLAP' && other
            ? `This overlaps the entry from ${dateTimeLabel(other.startedAt, this.data.timeZone)}${
                other.endedAt
                  ? ` to ${timeOfDay(other.endedAt, this.data.timeZone)}`
                  : ' (still running)'
              }.`
            : apiError.message,
        );
      },
    });
  }
}
