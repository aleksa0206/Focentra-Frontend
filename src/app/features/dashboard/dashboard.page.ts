import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { RouterLink } from '@angular/router';
import { GoalsApi, StatsApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { TimerService } from '../../core/timer.service';
import { WeekBars } from '../../shared/charts/week-bars';
import { EmptyState, LoadError } from '../../shared/ui/feedback';
import { GoalCard } from '../../shared/ui/goal-card';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { addDays, durationText, todayKey } from '../../shared/util/time';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, EmptyState, LoadError, GoalCard, Icon, WeekBars],
  template: `
    <div class="page">
      <app-page-header
        [title]="greeting()"
        description="Where your time went and how your goals are doing."
      >
        <a class="btn" routerLink="/goals/new">
          <app-icon name="plus" />
          New goal
        </a>
      </app-page-header>

      <section class="panel stats" aria-label="Time summary">
        <div class="stat">
          <span class="stat__label">Today</span>
          <span class="stat__value">{{ today() }}</span>
        </div>
        <div class="stat">
          <span class="stat__label">This week</span>
          <span class="stat__value">{{ thisWeek() }}</span>
          <span class="stat__hint">{{ weekHint() }}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Streak</span>
          <span class="stat__value">{{ streak() }} {{ streak() === 1 ? 'day' : 'days' }}</span>
          <span class="stat__hint">Days in a row with tracked time</span>
        </div>
      </section>

      <div class="layout-split dashboard">
        <section class="section" aria-labelledby="goals-title">
          <div class="section__header">
            <h2 id="goals-title">Active goals</h2>
            <a routerLink="/goals" class="text-secondary">All goals</a>
          </div>

          @if (goals.error(); as error) {
            <app-load-error [error]="error" (retry)="goals.reload()" />
          } @else if (goals.value(); as list) {
            @if (list.length === 0) {
              <div class="panel">
                <app-empty-state
                  icon="target"
                  title="No goals yet"
                  description="A goal turns tracked time into progress: e.g. 40 hours of Angular by December, or 8 hours of study every week."
                >
                  <a class="btn btn--primary" routerLink="/goals/new">Create your first goal</a>
                </app-empty-state>
              </div>
            } @else {
              <ul class="goal-cards">
                @for (goal of list; track goal.id) {
                  <li><app-goal-card [goal]="goal" /></li>
                }
              </ul>
            }
          } @else {
            <div class="panel goal-skeleton"><span class="skeleton" style="width: 60%"></span></div>
          }
        </section>

        <section class="panel" aria-labelledby="trend-title">
          <div class="panel__header">
            <h2 class="panel__title" id="trend-title">Hours per week</h2>
            <a routerLink="/stats" class="text-secondary">Statistics</a>
          </div>
          <div class="panel__body">
            @if (trend.value(); as t) {
              <app-week-bars [weeks]="t.data.weeks" />
            } @else if (trend.error()) {
              <p class="text-secondary">The chart could not be loaded.</p>
            } @else {
              <span class="skeleton" style="height: 160px"></span>
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .stats {
      margin-bottom: var(--space-6);
    }
    .goal-skeleton {
      padding: var(--space-4);
    }
    .goal-cards {
      display: grid;
      gap: var(--space-3);
    }
  `,
})
export default class DashboardPage {
  private readonly goalsApi = inject(GoalsApi);
  private readonly statsApi = inject(StatsApi);
  private readonly auth = inject(AuthService);
  protected readonly timer = inject(TimerService);

  // Reloads whenever a timer starts or stops anywhere in the app.
  protected readonly goals = rxResource({
    params: () => this.timer.changes(),
    stream: () => this.goalsApi.list(),
  });
  protected readonly trend = rxResource({
    params: () => this.timer.changes(),
    stream: () => this.statsApi.trend(12).pipe(map((data) => ({ data, loadedAt: Date.now() }))),
  });
  private readonly recent = rxResource({
    params: () => ({ changes: this.timer.changes(), zone: this.auth.timeZone() }),
    stream: ({ params }) => {
      const to = todayKey(params.zone);
      return this.statsApi
        .heatmap({ from: addDays(to, -60), to })
        .pipe(map((data) => ({ data, loadedAt: Date.now() })));
    },
  });

  protected readonly greeting = computed(() => {
    const name = this.auth.user()?.name.split(' ')[0];
    return name ? `Hi, ${name}` : 'Dashboard';
  });

  protected readonly today = computed(() => {
    const recent = this.recent.value();
    const key = todayKey(this.auth.timeZone());
    const logged = recent?.data.days.find((d) => d.date === key)?.seconds ?? 0;
    return durationText(logged + (recent ? this.timer.sinceLoaded(recent.loadedAt) : 0));
  });

  protected readonly thisWeek = computed(() => {
    const trend = this.trend.value();
    const logged = trend?.data.weeks.at(-1)?.seconds ?? 0;
    return durationText(logged + (trend ? this.timer.sinceLoaded(trend.loadedAt) : 0));
  });

  protected readonly weekHint = computed(() => {
    const previous = (this.trend.value()?.data.weeks ?? []).slice(0, -1);
    if (!previous.length) {
      return '';
    }
    const average = previous.reduce((sum, w) => sum + w.seconds, 0) / previous.length;
    return `Average ${durationText(average)} over the previous ${previous.length} weeks`;
  });

  protected readonly streak = computed(() => {
    const running = !!this.timer.running();
    const active = new Set(
      (this.recent.value()?.data.days ?? []).filter((d) => d.seconds > 0).map((d) => d.date),
    );
    let day = todayKey(this.auth.timeZone());
    if (running) {
      active.add(day);
    }
    // No time yet today doesn't break a streak that ran until yesterday.
    if (!active.has(day)) {
      day = addDays(day, -1);
    }
    let count = 0;
    while (active.has(day)) {
      count++;
      day = addDays(day, -1);
    }
    return count;
  });
}
