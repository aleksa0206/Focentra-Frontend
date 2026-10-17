import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Goal } from '../../core/api/models';
import {
  goalValueText,
  paceSentence,
  progressRatio,
  STATUS_LABELS,
  STATUS_TONES,
} from '../util/goal-format';

/** Status as a badge: an icon and a word, never colour alone. */
@Component({
  selector: 'app-pace-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="tone() ? 'badge badge--' + tone() : 'badge'">
      {{ label() }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class PaceBadge {
  readonly status = input.required<Goal['progress']['status']>();
  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
  protected readonly tone = computed(() => STATUS_TONES[this.status()]);
}

/** Bar with a marker where progress should be by now, the numbers and one sentence of pace. */
@Component({
  selector: 'app-goal-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PaceBadge],
  template: `
    <div class="goal-progress__numbers">
      <span>
        <strong>{{ value() }}</strong>
        <span class="text-secondary"> of {{ target() }}</span>
        @if (period()) {
          <span class="text-meta"> {{ period() }}</span>
        }
      </span>
      <app-pace-badge [status]="goal().progress.status" />
    </div>
    <div
      class="progress"
      role="progressbar"
      [attr.aria-valuenow]="percent()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="goal().name + ' progress'"
    >
      <div class="progress__fill" [style.width.%]="percent()"></div>
      @if (showMarker()) {
        <div class="progress__marker" [style.left.%]="expectedPercent()"></div>
      }
    </div>
    <p class="text-meta goal-progress__pace">{{ sentence() }}</p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
    }
    .goal-progress__numbers {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
  `,
})
export class GoalProgress {
  readonly goal = input.required<Goal>();

  protected readonly value = computed(() => goalValueText(this.goal(), this.goal().progress.value));
  protected readonly target = computed(() =>
    goalValueText(this.goal(), this.goal().progress.target),
  );
  protected readonly period = computed(() =>
    this.goal().mode === 'RECURRING'
      ? this.goal().period === 'WEEKLY'
        ? 'this week'
        : 'this month'
      : '',
  );
  protected readonly percent = computed(() =>
    Math.round(progressRatio(this.goal().progress) * 100),
  );
  protected readonly expectedPercent = computed(() => {
    const { expected, target } = this.goal().progress;
    return target > 0 ? Math.min(100, (expected / target) * 100) : 0;
  });
  protected readonly showMarker = computed(() =>
    ['AHEAD', 'ON_TRACK', 'BEHIND'].includes(this.goal().progress.status),
  );
  protected readonly sentence = computed(() => paceSentence(this.goal(), this.goal().progress));
}
