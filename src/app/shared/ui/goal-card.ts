import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { Goal } from '../../core/api/models';
import { TimerService } from '../../core/timer.service';
import { goalColor, scheduleText } from '../util/goal-format';
import { GoalProgress } from './goal-progress';
import { Icon } from './icon';
import { ToastService } from './toast';

/** A goal in a list: name, schedule, progress and the quickest way to add to it. */
@Component({
  selector: 'app-goal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, GoalProgress, Icon],
  host: { class: 'panel' },
  template: `
    <div class="goal-card__head">
      <a
        class="goal-card__name goal-dot"
        [style.--goal-color]="color()"
        [routerLink]="['/goals', goal().id]"
      >
        {{ goal().name }}
      </a>
      @if (!goal().archived) {
        @if (goal().type === 'TIME') {
          <button
            type="button"
            class="btn btn--sm"
            [disabled]="!!timer.running()"
            [attr.aria-label]="'Start timer on ' + goal().name"
            (click)="start()"
          >
            <app-icon name="play" [size]="12" />
            Start
          </button>
        } @else {
          <a
            class="btn btn--sm"
            [routerLink]="['/goals', goal().id]"
            fragment="log"
            [attr.aria-label]="'Log progress on ' + goal().name"
          >
            <app-icon name="plus" [size]="12" />
            Log
          </a>
        }
      }
    </div>
    <p class="text-meta">
      {{ schedule() }}
      @if (goal().memberCount > 1) {
        · shared, {{ goal().memberCount }} members
      }
    </p>
    <app-goal-progress [goal]="goal()" />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-4);
    }
    .goal-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .goal-card__name {
      min-width: 0;
      color: var(--color-text);
      font-weight: var(--font-weight-semibold);
    }
  `,
})
export class GoalCard {
  readonly goal = input.required<Goal>();

  protected readonly timer = inject(TimerService);
  private readonly toast = inject(ToastService);
  protected readonly color = computed(() => goalColor(this.goal().id));
  protected readonly schedule = computed(() => scheduleText(this.goal()));

  protected start(): void {
    this.timer.startTimer(this.goal().id).subscribe({
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
