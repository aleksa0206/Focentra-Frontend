import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { GoalDetail, GoalPeriodSummary } from '../../core/api/models';
import { GoalsApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { TimerService } from '../../core/timer.service';
import { ProgressChart } from '../../shared/charts/progress-chart';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { LoadError } from '../../shared/ui/feedback';
import { GoalProgress } from '../../shared/ui/goal-progress';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';
import { goalValueText, scheduleText } from '../../shared/util/goal-format';
import { dateKeyIn, dayLabel } from '../../shared/util/time';
import { GoalLog } from './goal-log';
import { GoalSharing } from './goal-sharing';

@Component({
  selector: 'app-goal-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeader,
    LoadError,
    GoalProgress,
    Icon,
    ProgressChart,
    GoalLog,
    GoalSharing,
  ],
  template: `
    <div class="page">
      @if (goal.error(); as error) {
        <app-page-header title="Goal" backLink="/goals" backLabel="Goals" />
        <app-load-error [error]="error" (retry)="goal.reload()" />
      } @else if (goal.value(); as g) {
        <app-page-header
          [title]="g.name"
          [description]="schedule(g)"
          backLink="/goals"
          backLabel="Goals"
        >
          @if (g.type === 'TIME' && !g.archived) {
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="!!timer.running()"
              (click)="start(g)"
            >
              <app-icon name="play" [size]="14" />
              Start timer
            </button>
          }
          @if (g.role === 'OWNER') {
            <a class="btn" [routerLink]="['/goals', g.id, 'edit']">
              <app-icon name="pencil" [size]="14" />
              Edit
            </a>
            <button type="button" class="btn" (click)="toggleArchive(g)">
              <app-icon name="archive" [size]="14" />
              {{ g.archived ? 'Restore' : 'Archive' }}
            </button>
            <button type="button" class="btn btn--ghost" (click)="remove(g)">
              <app-icon name="trash" [size]="14" />
              Delete
            </button>
          }
        </app-page-header>

        @if (g.archived) {
          <p class="alert alert--warning archived" role="status">
            <app-icon name="archive" />
            This goal is archived: nothing new can be logged on it.
          </p>
        }

        <div class="layout-split">
          <div class="stack">
            <section class="panel panel__body" aria-label="Progress">
              <app-goal-progress [goal]="g" />
              @if (zoneNote(g); as note) {
                <p class="text-meta zone-note">{{ note }}</p>
              }
            </section>

            <section class="panel" aria-labelledby="chart-title">
              <div class="panel__header">
                <h2 class="panel__title" id="chart-title">
                  {{
                    g.mode === 'RECURRING'
                      ? g.period === 'WEEKLY'
                        ? 'This week'
                        : 'This month'
                      : 'Progress over time'
                  }}
                </h2>
              </div>
              <div class="panel__body">
                @if (chart.value(); as c) {
                  @if (c.points.length) {
                    <app-progress-chart
                      [chart]="c"
                      [type]="g.type"
                      [unit]="g.unit"
                      [timeZone]="g.timezone"
                    />
                  } @else {
                    <p class="text-secondary">The chart starts on {{ startLabel(g) }}.</p>
                  }
                } @else if (chart.error()) {
                  <p class="text-secondary">The chart could not be loaded.</p>
                } @else {
                  <span class="skeleton" style="height: 200px"></span>
                }
              </div>
            </section>

            @if (g.mode === 'RECURRING') {
              <section class="panel" aria-labelledby="periods-title">
                <div class="panel__header">
                  <h2 class="panel__title" id="periods-title">
                    Past {{ g.period === 'WEEKLY' ? 'weeks' : 'months' }}
                  </h2>
                  @if (hitRate(); as rate) {
                    <span class="text-secondary">{{ rate }}</span>
                  }
                </div>
                <div class="table-wrap table-wrap--flush">
                  <table class="table">
                    <thead>
                      <tr>
                        <th scope="col">{{ g.period === 'WEEKLY' ? 'Week of' : 'Month' }}</th>
                        <th scope="col" class="num">Done</th>
                        <th scope="col" class="num">Target</th>
                        <th scope="col">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of periods.value() ?? []; track p.start) {
                        <tr>
                          <td>{{ periodLabel(g, p) }}</td>
                          <td class="num">{{ value(g, p.value) }}</td>
                          <td class="num">{{ value(g, p.target) }}</td>
                          <td>
                            @if (p.current) {
                              <span class="badge badge--info">In progress</span>
                            } @else if (p.achieved) {
                              <span class="badge badge--success">Reached</span>
                            } @else {
                              <span class="badge badge--danger">Missed</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>
            }

            <app-goal-log [goal]="g" (changed)="reloadAll()" />
          </div>

          <div class="stack">
            @if (g.contributions.length > 1) {
              <section class="panel" aria-labelledby="contrib-title">
                <div class="panel__header">
                  <h2 class="panel__title" id="contrib-title">Contributions</h2>
                </div>
                <ul class="panel__body contributions">
                  @for (c of g.contributions; track c.userId) {
                    <li>
                      <span>{{ c.name ?? 'Former member' }}</span>
                      <strong>{{ value(g, c.value) }}</strong>
                    </li>
                  }
                </ul>
              </section>
            }
            <app-goal-sharing [goal]="g" (changed)="onMembership($event)" />
          </div>
        </div>
      } @else {
        <span class="skeleton" style="width: 30%; height: 28px"></span>
      }
    </div>
  `,
  styles: `
    .archived {
      margin-bottom: var(--space-5);
    }
    .zone-note {
      margin-top: var(--space-2);
    }
    .contributions {
      display: grid;
      gap: var(--space-2);
      li {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
      }
    }
  `,
})
export default class GoalDetailPage {
  private readonly api = inject(GoalsApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly timer = inject(TimerService);

  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly goalId = computed(() => Number(this.id()));

  protected readonly goal = rxResource({
    params: () => ({ id: this.goalId(), changes: this.timer.changes() }),
    stream: ({ params }) => this.api.get(params.id),
  });
  protected readonly chart = rxResource({
    params: () => ({ id: this.goalId(), changes: this.timer.changes() }),
    stream: ({ params }) => this.api.chart(params.id),
  });
  protected readonly periods = rxResource({
    params: () => {
      const g = this.goal.value();
      return g?.mode === 'RECURRING'
        ? { id: g.id, target: g.target, value: g.progress.value }
        : null;
    },
    stream: ({ params }) => (params ? this.api.periods(params.id) : of([])),
  });

  protected readonly schedule = scheduleText;

  protected readonly hitRate = computed(() => {
    const past = (this.periods.value() ?? []).filter((p) => !p.current);
    if (!past.length) return '';
    const hits = past.filter((p) => p.achieved).length;
    return `Reached ${hits} of the last ${past.length}`;
  });

  protected value(goal: GoalDetail, value: number): string {
    return goalValueText(goal, value, goal.type === 'TIME' && value < 3600);
  }

  protected periodLabel(goal: GoalDetail, period: GoalPeriodSummary): string {
    const key = dateKeyIn(period.start, goal.timezone);
    return goal.period === 'MONTHLY'
      ? new Date(`${key}T12:00:00Z`).toLocaleString('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : dayLabel(key, false);
  }

  protected startLabel(goal: GoalDetail): string {
    return dayLabel(goal.startDate, false);
  }

  /** Days of a goal are counted in its own zone (the owner's when it was created). */
  protected zoneNote(goal: GoalDetail): string {
    return goal.timezone !== this.auth.timeZone()
      ? `Days and weeks of this goal are counted in ${goal.timezone}.`
      : '';
  }

  protected reloadAll(): void {
    this.goal.reload();
    this.chart.reload();
  }

  protected onMembership(event: 'members' | 'left'): void {
    if (event === 'left') {
      void this.router.navigate(['/goals']);
    } else {
      this.reloadAll();
    }
  }

  protected start(goal: GoalDetail): void {
    this.timer.startTimer(goal.id).subscribe({
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected toggleArchive(goal: GoalDetail): void {
    this.api.update(goal.id, { archived: !goal.archived }).subscribe({
      next: () => {
        this.toast.success(goal.archived ? 'Goal restored.' : 'Goal archived.');
        // Archiving stops timers running on the goal.
        this.timer.refresh();
        this.reloadAll();
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected async remove(goal: GoalDetail): Promise<void> {
    const shared = goal.memberCount > 1;
    const ok = await this.confirm.confirm({
      title: `Delete "${goal.name}"?`,
      message:
        (shared ? 'The goal disappears for all members too. ' : '') +
        'Tracked time stays in the time log without a goal; logged units are deleted. This cannot be undone.',
      confirmLabel: 'Delete goal',
      tone: 'danger',
    });
    if (!ok) return;
    this.api.remove(goal.id).subscribe({
      next: () => {
        this.toast.success('Goal deleted.');
        this.timer.refresh();
        void this.router.navigate(['/goals']);
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
