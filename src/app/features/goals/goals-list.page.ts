import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { GoalsApi } from '../../core/api/resources';
import { TimerService } from '../../core/timer.service';
import { EmptyState, LoadError } from '../../shared/ui/feedback';
import { GoalCard } from '../../shared/ui/goal-card';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Tabs } from '../../shared/ui/tabs';

type State = 'active' | 'archived';

@Component({
  selector: 'app-goals-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, EmptyState, LoadError, GoalCard, Icon, Tabs],
  template: `
    <div class="page">
      <app-page-header
        title="Goals"
        description="Goals in hours fill up from the timer; goals in units (pages, tasks) from what you log."
      >
        <a class="btn btn--primary" routerLink="/goals/new">
          <app-icon name="plus" />
          New goal
        </a>
      </app-page-header>

      <div class="panel">
        <app-tabs
          label="Goal state"
          idPrefix="goals"
          [tabs]="tabs"
          [active]="current()"
          (select)="show($any($event))"
        />
        <div
          class="panel__body"
          role="tabpanel"
          id="goals-panel"
          [attr.aria-labelledby]="'goals-tab-' + current()"
        >
          @if (goals.error(); as error) {
            <app-load-error [error]="error" (retry)="goals.reload()" />
          } @else if (goals.value(); as list) {
            @if (list.length === 0) {
              @if (current() === 'active') {
                <app-empty-state
                  icon="target"
                  title="No active goals"
                  description="Set a target in hours or units, with a deadline or every week or month."
                >
                  <a class="btn btn--primary" routerLink="/goals/new">New goal</a>
                </app-empty-state>
              } @else {
                <app-empty-state
                  icon="archive"
                  title="Nothing archived"
                  description="Archived goals keep their history but leave your lists."
                />
              }
            } @else {
              <ul class="goal-grid">
                @for (goal of list; track goal.id) {
                  <li><app-goal-card [goal]="goal" /></li>
                }
              </ul>
            }
          } @else {
            <span class="skeleton" style="width: 40%"></span>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .goal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-3);
    }
    @media (max-width: 400px) {
      .goal-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export default class GoalsListPage {
  private readonly api = inject(GoalsApi);
  private readonly router = inject(Router);
  private readonly timer = inject(TimerService);

  /** From the URL (?state=archived), so the tab survives reloads and back navigation. */
  readonly state = input<string>();
  protected readonly current = computed<State>(() =>
    this.state() === 'archived' ? 'archived' : 'active',
  );
  protected readonly tabs = [
    { id: 'active', label: 'Active' },
    { id: 'archived', label: 'Archived' },
  ];

  protected readonly goals = rxResource({
    params: () => ({ state: this.current(), changes: this.timer.changes() }),
    stream: ({ params }) => this.api.list(params.state),
  });

  protected show(state: State): void {
    void this.router.navigate([], { queryParams: { state: state === 'active' ? null : state } });
  }
}
