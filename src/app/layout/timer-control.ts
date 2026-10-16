import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { toApiError } from '../core/api/api-error';
import { GoalsApi } from '../core/api/resources';
import { TimerService } from '../core/timer.service';
import { Icon } from '../shared/ui/icon';
import { ToastService } from '../shared/ui/toast';
import { goalColor } from '../shared/util/goal-format';
import { clockText, durationText } from '../shared/util/time';

/** Start/stop in the top bar, on every page: logging has to take less than five seconds. */
@Component({
  selector: 'app-timer-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, Icon, RouterLink],
  template: `
    @if (timer.running(); as entry) {
      <div class="timer timer--running" [class.timer--long]="timer.longRunning()">
        <span class="timer__pulse" aria-hidden="true"></span>
        <span class="timer__text">
          <span
            class="timer__clock"
            role="timer"
            [attr.aria-label]="'Timer running, ' + elapsedText()"
          >
            {{ clock() }}
          </span>
          <span class="timer__goal">{{ runningGoalName() }}</span>
        </span>
        <button type="button" class="btn btn--sm timer__stop" [disabled]="busy()" (click)="stop()">
          <span class="timer__stop-icon" aria-hidden="true"></span>
          Stop
        </button>
      </div>
      @if (timer.longRunning()) {
        <a
          class="timer__warning"
          [routerLink]="['/entries']"
          title="Still working? Fix the entry if you forgot to stop."
        >
          <app-icon name="warning" [size]="14" />
          <span class="visually-hidden">The timer has been running for over 8 hours</span>
        </a>
      }
    } @else {
      <div class="timer">
        <button
          type="button"
          class="btn btn--primary timer__start"
          [disabled]="busy()"
          (click)="start(null)"
        >
          <app-icon name="play" [size]="14" />
          <span class="timer__start-label">Start timer</span>
        </button>
        <button
          type="button"
          class="btn btn--primary btn--icon timer__pick"
          [cdkMenuTriggerFor]="goalMenu"
          [disabled]="busy()"
          aria-label="Start timer on a goal"
        >
          <app-icon name="chevronDown" [size]="14" />
        </button>
      </div>
      <ng-template #goalMenu>
        <div class="menu" cdkMenu>
          <p class="menu__label">Start on a goal</p>
          @for (goal of timeGoals(); track goal.id) {
            <button
              type="button"
              class="menu__item"
              cdkMenuItem
              (cdkMenuItemTriggered)="start(goal.id)"
            >
              <span class="goal-dot" [style.--goal-color]="color(goal.id)">{{ goal.name }}</span>
            </button>
          } @empty {
            <p class="menu__empty text-secondary">No goals in hours yet.</p>
          }
          <div class="menu__separator"></div>
          <button type="button" class="menu__item" cdkMenuItem (cdkMenuItemTriggered)="start(null)">
            Without a goal
          </button>
        </div>
      </ng-template>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    .timer {
      display: inline-flex;
      align-items: center;
      gap: 1px;
    }
    .timer__start {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
    .timer__pick {
      width: 28px;
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
    .timer--running {
      gap: var(--space-3);
      height: var(--control-height);
      padding: 0 4px 0 var(--space-3);
      border: 1px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
      border-radius: var(--radius-sm);
      background: var(--color-accent-subtle);
    }
    .timer--long {
      border-color: color-mix(in srgb, var(--color-warning) 45%, transparent);
      background: var(--color-warning-subtle);
    }
    .timer__pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-accent);
      animation: pulse 1.6s ease-in-out infinite;
    }
    .timer__text {
      display: grid;
      line-height: 1.1;
    }
    .timer__clock {
      font-weight: var(--font-weight-semibold);
      font-variant-numeric: tabular-nums;
    }
    .timer__goal {
      max-width: 160px;
      overflow: hidden;
      color: var(--color-text-secondary);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .timer__stop-icon {
      width: 9px;
      height: 9px;
      border-radius: 2px;
      background: var(--color-danger);
    }
    .timer__warning {
      display: inline-flex;
      color: var(--color-warning);
    }
    .menu__label {
      padding: var(--space-1) var(--space-2);
      color: var(--color-text-tertiary);
      font-size: var(--font-size-meta);
    }
    .menu__empty {
      padding: var(--space-2);
    }
    @media (max-width: 639.98px) {
      .timer__start-label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
      .timer__goal {
        max-width: 90px;
      }
    }
    @keyframes pulse {
      50% {
        opacity: 0.3;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .timer__pulse {
        animation: none;
      }
    }
  `,
})
export class TimerControl {
  protected readonly timer = inject(TimerService);
  private readonly goalsApi = inject(GoalsApi);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);

  protected readonly goals = rxResource({
    params: () => this.timer.changes(),
    stream: () => this.goalsApi.list(),
  });
  protected readonly timeGoals = computed(() =>
    (this.goals.value() ?? []).filter((g) => g.type === 'TIME'),
  );
  protected readonly runningGoalName = computed(() => {
    const goalId = this.timer.running()?.goalId;
    if (goalId === null || goalId === undefined) {
      return 'No goal';
    }
    return this.goals.value()?.find((g) => g.id === goalId)?.name ?? 'Goal';
  });

  protected readonly clock = computed(() => clockText(this.timer.elapsedSeconds()));
  // Updated once a minute for screen readers instead of every second.
  protected readonly elapsedText = computed(() =>
    durationText(Math.floor(this.timer.elapsedSeconds() / 60) * 60),
  );
  protected readonly color = goalColor;

  protected start(goalId: number | null): void {
    this.run(this.timer.startTimer(goalId));
  }

  protected stop(): void {
    this.run(this.timer.stopTimer(), (seconds) => `Logged ${durationText(seconds)}.`);
  }

  private run(
    request: ReturnType<TimerService['stopTimer']>,
    successMessage?: (seconds: number) => string,
  ): void {
    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (entry) => successMessage && this.toast.success(successMessage(entry.durationSeconds)),
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
