import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DateKey, GoalChart, GoalType } from '../../core/api/models';
import { goalValueText } from '../util/goal-format';
import { addDays, dateKeyIn, dayLabel, daysBetween } from '../util/time';
import { hostWidth, hourTicks, niceTicks } from './scale';

const DEFAULT_WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 16, right: 56, bottom: 26, left: 48 };

/**
 * Cumulative progress against the even pace that reaches the target exactly at the end of the
 * window (US-03): above the gray line means ahead, below means behind. Two series, so a legend
 * names both; the end value is labeled directly.
 */
@Component({
  selector: 'app-progress-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="chart-legend">
      <li><span class="chart-key chart-key--actual"></span>Progress</li>
      <li><span class="chart-key chart-key--plan"></span>Even pace to target</li>
    </ul>
    <div class="chart">
      <svg
        [attr.viewBox]="'0 0 ' + width() + ' ' + height"
        role="img"
        [attr.aria-label]="summary()"
        (pointermove)="track($event)"
        (pointerleave)="hoverIndex.set(null)"
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
            {{ valueText(tick) }}
          </text>
        }
        @for (tick of xTicks(); track tick.key) {
          <text class="chart-axis" [attr.x]="tick.x" [attr.y]="height - 8" text-anchor="middle">
            {{ tick.label }}
          </text>
        }

        <line
          class="chart-plan"
          [attr.x1]="x(0)"
          [attr.y1]="y(0)"
          [attr.x2]="x(totalDays())"
          [attr.y2]="y(chart().target)"
        />
        @if (areaPath(); as area) {
          <path class="chart-area" [attr.d]="area" />
          <path class="chart-line" [attr.d]="linePath()" />
        }
        @if (lastPoint(); as last) {
          <circle class="chart-dot" [attr.cx]="last.x" [attr.cy]="last.y" r="4" />
          <text class="chart-value" [attr.x]="last.x + 8" [attr.y]="last.y + 4">
            {{ valueText(last.value) }}
          </text>
        }
        @if (hovered(); as point) {
          <line
            class="chart-crosshair"
            [attr.x1]="point.x"
            [attr.x2]="point.x"
            [attr.y1]="pad.top"
            [attr.y2]="height - pad.bottom"
          />
          <circle class="chart-dot" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
        }
      </svg>
      @if (hovered(); as point) {
        <div
          class="chart-tooltip"
          [style.left.%]="(point.x / width()) * 100"
          [style.top.%]="(point.y / height) * 100"
          aria-hidden="true"
        >
          <strong>{{ valueText(point.value) }}</strong>
          <span>Plan: {{ valueText(point.plan) }}</span>
          <span>{{ label(point.date) }}</span>
        </div>
      }
    </div>
    <details class="chart-table">
      <summary>Show as table</summary>
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col" class="num">Progress</th>
            <th scope="col" class="num">Even pace</th>
          </tr>
        </thead>
        <tbody>
          @for (point of points(); track point.date) {
            <tr>
              <td>{{ label(point.date) }}</td>
              <td class="num">{{ valueText(point.value) }}</td>
              <td class="num">{{ valueText(point.plan) }}</td>
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
    .chart-plan {
      stroke: var(--color-text-tertiary);
      stroke-width: 1.5;
    }
    .chart-line {
      fill: none;
      stroke: var(--color-accent);
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .chart-area {
      fill: var(--color-accent);
      opacity: 0.1;
    }
  `,
})
export class ProgressChart {
  readonly chart = input.required<GoalChart>();
  readonly type = input.required<GoalType>();
  readonly unit = input<string | null>(null);
  readonly timeZone = input.required<string>();

  protected readonly width = hostWidth(DEFAULT_WIDTH);
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;
  protected readonly hoverIndex = signal<number | null>(null);
  protected readonly label = (key: DateKey) => dayLabel(key);

  private readonly startKey = computed(() => dateKeyIn(this.chart().windowStart, this.timeZone()));
  /** Number of days in the window (the end is exclusive midnight). */
  protected readonly totalDays = computed(() =>
    Math.max(
      1,
      daysBetween(
        this.startKey(),
        dateKeyIn(new Date(new Date(this.chart().windowEnd).getTime() - 1), this.timeZone()),
      ) + 1,
    ),
  );

  protected readonly ticks = computed(() => {
    const max = Math.max(this.chart().target, ...this.chart().points.map((p) => p.value));
    return this.type() === 'TIME' ? hourTicks(max) : niceTicks(max);
  });

  protected valueText(value: number): string {
    return goalValueText({ type: this.type(), unit: this.unit() }, value);
  }

  protected x(dayIndex: number): number {
    return PAD.left + (dayIndex / this.totalDays()) * (this.width() - PAD.left - PAD.right);
  }

  protected y(value: number): number {
    const plot = HEIGHT - PAD.top - PAD.bottom;
    return PAD.top + plot - (value / this.ticks().at(-1)!) * plot;
  }

  /** Each point sits at the end of its day, where the cumulative value is reached. */
  protected readonly points = computed(() => {
    const { target } = this.chart();
    const days = this.totalDays();
    return this.chart().points.map((p) => {
      const index = daysBetween(this.startKey(), p.date) + 1;
      return {
        ...p,
        x: this.x(index),
        y: this.y(p.value),
        plan: Math.round((target * index) / days),
      };
    });
  });

  protected readonly linePath = computed(() => {
    const points = this.points();
    return points.length
      ? `M${this.x(0)},${this.y(0)} ` + points.map((p) => `L${p.x},${p.y}`).join(' ')
      : '';
  });

  protected readonly areaPath = computed(() => {
    const points = this.points();
    if (!points.length) {
      return null;
    }
    return `${this.linePath()} L${points.at(-1)!.x},${this.y(0)} Z`;
  });

  protected readonly lastPoint = computed(() => this.points().at(-1) ?? null);
  protected readonly hovered = computed(() => {
    const index = this.hoverIndex();
    return index === null ? null : (this.points()[index] ?? null);
  });

  protected readonly xTicks = computed(() => {
    const days = this.totalDays();
    // A week gets a tick per day; longer windows five evenly spaced ones.
    const count = days <= 8 ? days : 5;
    return Array.from({ length: count + 1 }, (_, i) => {
      const index = Math.round((days * i) / count);
      const key = addDays(this.startKey(), index);
      return { key, x: this.x(index), label: dayLabel(key, false) };
    });
  });

  /** The crosshair snaps to the nearest day. */
  protected track(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * this.width();
    const points = this.points();
    if (!points.length) {
      return;
    }
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i]!.x - x) < Math.abs(points[best]!.x - x)) {
        best = i;
      }
    }
    this.hoverIndex.set(best);
  }

  protected readonly summary = computed(() => {
    const last = this.points().at(-1);
    return last
      ? `Progress chart: ${this.valueText(last.value)} of ${this.valueText(this.chart().target)} by ${dayLabel(last.date, false)}; even pace would be ${this.valueText(last.plan)}.`
      : 'Progress chart: no data yet.';
  });
}
