import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DateKey } from '../../core/api/models';
import { dayLabel, durationText, hoursText } from '../util/time';
import { hostWidth, hourTicks } from './scale';

const DEFAULT_WIDTH = 560;
const HEIGHT = 200;
const PAD = { top: 20, right: 8, bottom: 24, left: 36 };
const MAX_BAR = 24;

interface Bar {
  weekStart: DateKey;
  seconds: number;
  x: number;
  y: number;
  width: number;
  height: number;
  slotX: number;
  slotWidth: number;
}

/** Hours per week as columns (one series, so no legend; the panel title names it). */
@Component({
  selector: 'app-week-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <svg
        [attr.viewBox]="'0 0 ' + width() + ' ' + height"
        role="img"
        [attr.aria-label]="summary()"
        (pointerleave)="hovered.set(null)"
      >
        @for (tick of ticks(); track tick) {
          <line
            class="chart-grid"
            [attr.x1]="pad.left"
            [attr.x2]="width() - pad.right"
            [attr.y1]="y(tick)"
            [attr.y2]="y(tick)"
          />
          <text class="chart-axis" [attr.x]="pad.left - 6" [attr.y]="y(tick) + 3" text-anchor="end">
            {{ hours(tick) }}
          </text>
        }
        @for (bar of bars(); track bar.weekStart; let i = $index; let last = $last) {
          @if (bar.height > 0) {
            <path
              class="week-bar"
              [class.week-bar--current]="last"
              [class.is-hovered]="hovered()?.weekStart === bar.weekStart"
              [attr.d]="barPath(bar)"
            />
          }
          @if ((i % labelEvery() === 0 && i < bars().length - labelEvery()) || last) {
            <text
              class="chart-axis"
              [attr.x]="bar.x + bar.width / 2"
              [attr.y]="height - 6"
              text-anchor="middle"
            >
              {{ last ? 'This week' : short(bar.weekStart) }}
            </text>
          }
          @if (last && bar.seconds > 0) {
            <text
              class="chart-value"
              [attr.x]="bar.x + bar.width / 2"
              [attr.y]="bar.y - 6"
              text-anchor="middle"
            >
              {{ hours(bar.seconds) }}
            </text>
          }
          <!-- The whole column slot is the hover target, not just the painted bar. -->
          <rect
            class="chart-hit"
            [attr.x]="bar.slotX"
            [attr.y]="pad.top"
            [attr.width]="bar.slotWidth"
            [attr.height]="height - pad.top - pad.bottom"
            (pointerenter)="hovered.set(bar)"
          />
        }
      </svg>
      @if (hovered(); as bar) {
        <div
          class="chart-tooltip"
          [style.left.%]="((bar.x + bar.width / 2) / width()) * 100"
          [style.top.%]="(bar.y / height) * 100"
          aria-hidden="true"
        >
          <strong>{{ duration(bar.seconds) }}</strong>
          <span>Week of {{ short(bar.weekStart) }}</span>
        </div>
      }
    </div>
    <details class="chart-table">
      <summary>Show as table</summary>
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col" class="num">Time</th>
          </tr>
        </thead>
        <tbody>
          @for (week of weeks(); track week.weekStart) {
            <tr>
              <td>{{ short(week.weekStart) }}</td>
              <td class="num">{{ duration(week.seconds) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </details>
  `,
  styles: `
    :host {
      display: block;
    }
    .week-bar {
      fill: color-mix(in srgb, var(--color-accent) 55%, var(--color-surface));
    }
    .week-bar--current {
      fill: var(--color-accent);
    }
    .week-bar.is-hovered {
      fill: var(--color-accent-hover);
    }
  `,
})
export class WeekBars {
  readonly weeks = input.required<{ weekStart: DateKey; seconds: number }[]>();

  protected readonly width = hostWidth(DEFAULT_WIDTH);
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;
  protected readonly hovered = signal<Bar | null>(null);
  protected readonly duration = durationText;
  protected readonly hours = hoursText;
  protected readonly short = (key: DateKey) => dayLabel(key, false);

  protected readonly ticks = computed(() =>
    hourTicks(Math.max(3600, ...this.weeks().map((w) => w.seconds))),
  );
  private readonly max = computed(() => this.ticks().at(-1)!);

  protected readonly labelEvery = computed(() => Math.ceil(this.weeks().length / 6));

  protected y(value: number): number {
    const plot = HEIGHT - PAD.top - PAD.bottom;
    return PAD.top + plot - (value / this.max()) * plot;
  }

  protected readonly bars = computed<Bar[]>(() => {
    const weeks = this.weeks();
    const slot = (this.width() - PAD.left - PAD.right) / Math.max(1, weeks.length);
    const barWidth = Math.min(MAX_BAR, slot * 0.6);
    return weeks.map((week, i) => {
      const slotX = PAD.left + i * slot;
      const y = this.y(week.seconds);
      return {
        ...week,
        slotX,
        slotWidth: slot,
        x: slotX + (slot - barWidth) / 2,
        width: barWidth,
        y,
        height: this.y(0) - y,
      };
    });
  });

  /** Square at the baseline, 4px rounded at the data end. */
  protected barPath(bar: Bar): string {
    const r = Math.min(4, bar.height, bar.width / 2);
    const bottom = bar.y + bar.height;
    return [
      `M${bar.x},${bottom}`,
      `V${bar.y + r}`,
      `Q${bar.x},${bar.y} ${bar.x + r},${bar.y}`,
      `H${bar.x + bar.width - r}`,
      `Q${bar.x + bar.width},${bar.y} ${bar.x + bar.width},${bar.y + r}`,
      `V${bottom}`,
      'Z',
    ].join(' ');
  }

  protected readonly summary = computed(() => {
    const weeks = this.weeks();
    const current = weeks.at(-1);
    const average = weeks.reduce((sum, w) => sum + w.seconds, 0) / Math.max(1, weeks.length);
    return `Hours per week over the last ${weeks.length} weeks. This week: ${durationText(current?.seconds ?? 0)}. Average: ${durationText(average)}.`;
  });
}
