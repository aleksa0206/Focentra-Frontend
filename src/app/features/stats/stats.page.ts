import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { StatsApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { TimerService } from '../../core/timer.service';
import { Heatmap } from '../../shared/charts/heatmap';
import { WeekBars } from '../../shared/charts/week-bars';
import { EmptyState, LoadError } from '../../shared/ui/feedback';
import { PageHeader } from '../../shared/ui/page-header';
import { goalColor } from '../../shared/util/goal-format';
import { addDays, durationText, todayKey, weekdayOf } from '../../shared/util/time';

type Range = 'week' | 'month' | '90d' | 'year';
const RANGES: { id: Range; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'year', label: 'Last 12 months' },
];

@Component({
  selector: 'app-stats-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, LoadError, EmptyState, Heatmap, WeekBars],
  template: `
    <div class="page">
      <app-page-header
        title="Statistics"
        [description]="'Only your own time, counted in ' + zone() + '.'"
      />

      <div class="stack">
        <section class="panel" aria-labelledby="heatmap-title">
          <div class="panel__header">
            <h2 class="panel__title" id="heatmap-title">Activity, last 12 months</h2>
            @if (heatmap.value(); as h) {
              <span class="text-secondary">{{ yearTotal() }} in total</span>
            }
          </div>
          <div class="panel__body">
            @if (heatmap.error(); as error) {
              <app-load-error [error]="error" (retry)="heatmap.reload()" />
            } @else if (heatmap.value(); as h) {
              <app-heatmap [from]="h.from" [to]="h.to" [days]="h.days" />
            } @else {
              <span class="skeleton" style="height: 120px"></span>
            }
          </div>
        </section>

        <section class="panel" aria-labelledby="weeks-title">
          <div class="panel__header">
            <h2 class="panel__title" id="weeks-title">Hours per week</h2>
          </div>
          <div class="panel__body">
            @if (trend.error(); as error) {
              <app-load-error [error]="error" (retry)="trend.reload()" />
            } @else if (trend.value(); as t) {
              <app-week-bars [weeks]="t.weeks" />
            } @else {
              <span class="skeleton" style="height: 180px"></span>
            }
          </div>
        </section>

        <section class="panel" aria-labelledby="breakdown-title">
          <div class="panel__header">
            <h2 class="panel__title" id="breakdown-title">Time per goal</h2>
            <div class="segmented" role="group" aria-label="Period">
              @for (r of ranges; track r.id) {
                <button
                  type="button"
                  [attr.aria-pressed]="currentRange() === r.id"
                  (click)="setRange(r.id)"
                >
                  {{ r.label }}
                </button>
              }
            </div>
          </div>
          <div class="panel__body">
            @if (breakdown.error(); as error) {
              <app-load-error [error]="error" (retry)="breakdown.reload()" />
            } @else if (breakdown.value(); as b) {
              @if (b.items.length === 0) {
                <app-empty-state icon="chart" title="No time in this period" />
              } @else {
                <ul class="breakdown">
                  @for (item of b.items; track item.goalId) {
                    <li>
                      <span class="breakdown__label">
                        @if (item.goalId !== null) {
                          <a
                            class="goal-dot"
                            [style.--goal-color]="color(item.goalId)"
                            [routerLink]="['/goals', item.goalId]"
                            >{{ item.name }}</a
                          >
                        } @else {
                          <span class="goal-dot">No goal</span>
                        }
                      </span>
                      <span class="breakdown__track" aria-hidden="true">
                        <span
                          class="breakdown__bar"
                          [style.width.%]="(item.seconds / maxSeconds()) * 100"
                        ></span>
                      </span>
                      <span class="breakdown__value">
                        <strong>{{ duration(item.seconds) }}</strong>
                        <span class="text-meta">{{ share(item.seconds) }}</span>
                      </span>
                    </li>
                  }
                </ul>
              }
            } @else {
              <span class="skeleton" style="height: 80px"></span>
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .panel__header {
      flex-wrap: wrap;
    }
    .breakdown {
      display: grid;
      gap: var(--space-3);
      li {
        display: grid;
        grid-template-columns: minmax(120px, 220px) 1fr 120px;
        align-items: center;
        gap: var(--space-3);
        @media (max-width: 640px) {
          grid-template-columns: 1fr auto;
          .breakdown__track {
            grid-column: 1 / -1;
            grid-row: 2;
          }
        }
      }
    }
    .breakdown__label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      a {
        color: var(--color-text);
      }
    }
    .breakdown__track {
      height: 12px;
    }
    .breakdown__bar {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: 0 4px 4px 0;
      background: var(--color-accent);
    }
    .breakdown__value {
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
})
export default class StatsPage {
  private readonly api = inject(StatsApi);
  private readonly auth = inject(AuthService);
  private readonly timer = inject(TimerService);
  private readonly router = inject(Router);

  readonly range = input<string>();
  protected readonly ranges = RANGES;
  protected readonly zone = this.auth.timeZone;
  protected readonly color = goalColor;
  protected readonly duration = durationText;
  protected readonly currentRange = computed<Range>(() =>
    RANGES.some((r) => r.id === this.range()) ? (this.range() as Range) : 'month',
  );

  protected readonly heatmap = rxResource({
    params: () => ({ changes: this.timer.changes(), zone: this.zone() }),
    stream: () => this.api.heatmap(),
  });
  protected readonly trend = rxResource({
    params: () => ({ changes: this.timer.changes(), zone: this.zone() }),
    stream: () => this.api.trend(12),
  });
  protected readonly breakdown = rxResource({
    params: () => {
      const to = todayKey(this.zone());
      const from = {
        week: addDays(to, -weekdayOf(to)),
        month: `${to.slice(0, 8)}01`,
        '90d': addDays(to, -89),
        year: addDays(to, -364),
      }[this.currentRange()];
      return { from, to, changes: this.timer.changes() };
    },
    stream: ({ params }) => this.api.breakdown({ from: params.from, to: params.to }),
  });

  protected readonly yearTotal = computed(() =>
    durationText((this.heatmap.value()?.days ?? []).reduce((sum, d) => sum + d.seconds, 0)),
  );
  protected readonly maxSeconds = computed(() =>
    Math.max(1, ...(this.breakdown.value()?.items ?? []).map((i) => i.seconds)),
  );
  private readonly totalSeconds = computed(() =>
    (this.breakdown.value()?.items ?? []).reduce((sum, i) => sum + i.seconds, 0),
  );

  protected share(seconds: number): string {
    return `${Math.round((seconds / Math.max(1, this.totalSeconds())) * 100)}%`;
  }

  protected setRange(range: Range): void {
    void this.router.navigate([], { queryParams: { range: range === 'month' ? null : range } });
  }
}
