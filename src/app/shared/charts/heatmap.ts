import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DateKey } from '../../core/api/models';
import { addDays, dayLabel, daysBetween, durationText, weekdayOf } from '../util/time';

const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP;
const LEFT = 30;
const TOP = 18;
/** Upper bounds (seconds) of heat levels 1-3; above the last is level 4. */
const LEVELS = [30 * 60, 90 * 60, 3 * 3600];

interface Cell {
  date: DateKey;
  seconds: number;
  level: number;
  x: number;
  y: number;
}

/**
 * Activity per day, a year on one grid (columns are weeks, Monday on top), like a GitHub
 * contribution graph. One hue, light to dark; days without activity recede toward the surface.
 * The same numbers are available as a table for screen readers and keyboard users.
 */
@Component({
  selector: 'app-heatmap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="heatmap__scroll">
      <svg
        class="heatmap"
        [attr.width]="width()"
        [attr.height]="height"
        role="img"
        [attr.aria-label]="summary()"
        (pointerleave)="hovered.set(null)"
      >
        @for (month of months(); track month.x) {
          <text class="heatmap__month" [attr.x]="month.x" y="10">{{ month.label }}</text>
        }
        @for (row of weekdayLabels; track row.label) {
          <text class="heatmap__weekday" x="0" [attr.y]="row.y">{{ row.label }}</text>
        }
        @for (cell of cells(); track cell.date) {
          <rect
            [attr.x]="cell.x"
            [attr.y]="cell.y"
            [attr.width]="cell_"
            [attr.height]="cell_"
            rx="2"
            [attr.fill]="'var(--heat-' + cell.level + ')'"
            [class.is-hovered]="hovered()?.date === cell.date"
            (pointerenter)="hovered.set(cell)"
          />
        }
      </svg>
      @if (hovered(); as cell) {
        <div
          class="chart-tooltip"
          [style.left.px]="cell.x + cell_ / 2"
          [style.top.px]="cell.y"
          aria-hidden="true"
        >
          <strong>{{ cell.seconds ? duration(cell.seconds) : 'No activity' }}</strong>
          <span>{{ label(cell.date) }}</span>
        </div>
      }
    </div>
    <div class="heatmap__footer">
      <span class="text-meta">{{ activeDays() }} active days</span>
      <span class="heatmap__legend" aria-hidden="true">
        Less
        @for (level of [0, 1, 2, 3, 4]; track level) {
          <span class="heatmap__swatch" [style.background]="'var(--heat-' + level + ')'"></span>
        }
        More
      </span>
    </div>
    <details class="chart-table">
      <summary>Show as table</summary>
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col" class="num">Time</th>
          </tr>
        </thead>
        <tbody>
          @for (day of activeList(); track day.date) {
            <tr>
              <td>{{ label(day.date) }}</td>
              <td class="num">{{ duration(day.seconds) }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="2">No activity in this period.</td>
            </tr>
          }
        </tbody>
      </table>
    </details>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .heatmap__scroll {
      position: relative;
      overflow-x: auto;
      padding-bottom: var(--space-1);
    }
    .heatmap {
      display: block;
    }
    .heatmap__month,
    .heatmap__weekday {
      fill: var(--color-text-tertiary);
      font-size: 10px;
    }
    rect.is-hovered {
      stroke: var(--color-text);
      stroke-width: 1.5;
    }
    .heatmap__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-top: var(--space-2);
    }
    .heatmap__legend {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--color-text-tertiary);
      font-size: var(--font-size-meta);
    }
    .heatmap__swatch {
      width: 11px;
      height: 11px;
      border-radius: 2px;
    }
  `,
})
export class Heatmap {
  readonly from = input.required<DateKey>();
  readonly to = input.required<DateKey>();
  readonly days = input.required<{ date: DateKey; seconds: number }[]>();

  protected readonly cell_ = CELL;
  protected readonly height = TOP + 7 * STEP;
  protected readonly hovered = signal<Cell | null>(null);
  protected readonly weekdayLabels = [
    { label: 'Mon', y: TOP + 0 * STEP + 10 },
    { label: 'Wed', y: TOP + 2 * STEP + 10 },
    { label: 'Fri', y: TOP + 4 * STEP + 10 },
  ];
  protected readonly duration = durationText;
  protected readonly label = (key: DateKey) => dayLabel(key);

  /** Grid starts on the Monday of the first week, so rows are always weekdays. */
  private readonly gridStart = computed(() => addDays(this.from(), -weekdayOf(this.from())));

  protected readonly cells = computed<Cell[]>(() => {
    const byDate = new Map(this.days().map((d) => [d.date, d.seconds]));
    const start = this.gridStart();
    const total = daysBetween(this.from(), this.to());
    const offset = daysBetween(start, this.from());
    const cells: Cell[] = [];
    for (let i = 0; i <= total; i++) {
      const date = addDays(this.from(), i);
      const seconds = byDate.get(date) ?? 0;
      const index = offset + i;
      cells.push({
        date,
        seconds,
        level: seconds === 0 ? 0 : 1 + LEVELS.filter((bound) => seconds > bound).length,
        x: LEFT + Math.floor(index / 7) * STEP,
        y: TOP + (index % 7) * STEP,
      });
    }
    return cells;
  });

  protected readonly width = computed(() => {
    const last = this.cells().at(-1);
    return (last?.x ?? LEFT) + CELL;
  });

  /** A month label above the first week that starts in that month. */
  protected readonly months = computed(() => {
    const labels: { x: number; label: string }[] = [];
    let previous = '';
    for (const cell of this.cells()) {
      const month = cell.date.slice(0, 7);
      if (month !== previous && weekdayOf(cell.date) === 0) {
        const x = cell.x;
        // Skip a label that would collide with the previous one.
        if (!labels.length || x - labels.at(-1)!.x >= 3 * STEP) {
          labels.push({
            x,
            label: new Date(`${cell.date}T12:00:00Z`).toLocaleString('en-GB', {
              month: 'short',
              timeZone: 'UTC',
            }),
          });
        }
        previous = month;
      }
    }
    return labels;
  });

  protected readonly activeList = computed(() =>
    this.days()
      .filter((d) => d.seconds > 0)
      .slice()
      .reverse(),
  );
  protected readonly activeDays = computed(() => this.activeList().length);

  protected readonly summary = computed(() => {
    const total = this.days().reduce((sum, d) => sum + d.seconds, 0);
    return `Activity heatmap: ${durationText(total)} over ${this.activeDays()} active days between ${dayLabel(this.from(), false)} and ${dayLabel(this.to(), false)}.`;
  });
}
