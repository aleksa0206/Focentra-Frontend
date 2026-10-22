import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { MembersApi } from '../../core/api/resources';
import { EmptyState, LoadError } from '../../shared/ui/feedback';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';

/** Opened from an invite link; signing in first is handled by the auth guard (returnUrl). */
@Component({
  selector: 'app-invite-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, EmptyState, LoadError],
  template: `
    <div class="page page--narrow">
      <app-page-header title="Join a goal" />
      @if (preview.error(); as error) {
        @if (expired(error)) {
          <div class="panel">
            <app-empty-state
              icon="link"
              title="This invite link doesn't work anymore"
              description="It may have expired (links last 7 days) or been revoked. Ask for a new one."
            >
              <a class="btn" routerLink="/">Go to dashboard</a>
            </app-empty-state>
          </div>
        } @else {
          <app-load-error [error]="error" (retry)="preview.reload()" />
        }
      } @else if (preview.value(); as p) {
        <section class="panel panel__body invite">
          <p class="text-secondary">{{ p.ownerName }} invites you to work on</p>
          <h2 class="invite__name">{{ p.goal.name }}</h2>
          <p class="text-meta">
            {{ p.goal.type === 'TIME' ? 'Measured in hours' : 'Measured in ' + p.goal.unit }} ·
            {{ p.memberCount }} {{ p.memberCount === 1 ? 'member' : 'members' }}
          </p>
          <p class="alert alert--info">
            Members see every entry logged on this goal (who, when, how long, notes). Your other
            goals and time stay private.
          </p>
          @if (p.alreadyMember) {
            <a class="btn btn--primary" [routerLink]="['/goals', p.goal.id]">Open the goal</a>
          } @else {
            <div class="form__actions">
              <button
                type="button"
                class="btn btn--primary"
                [disabled]="joining()"
                [attr.aria-busy]="joining()"
                (click)="join()"
              >
                Join goal
              </button>
              <a class="btn btn--ghost" routerLink="/">Not now</a>
            </div>
          }
        </section>
      } @else {
        <span class="skeleton" style="width: 60%"></span>
      }
    </div>
  `,
  styles: `
    .invite {
      display: grid;
      gap: var(--space-3);
    }
    .invite__name {
      font-size: 20px;
    }
  `,
})
export default class InvitePage {
  private readonly api = inject(MembersApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly token = input.required<string>();
  protected readonly joining = signal(false);
  protected readonly preview = rxResource({
    params: () => this.token(),
    stream: ({ params }) => this.api.preview(params),
  });

  protected expired(error: unknown): boolean {
    return toApiError(error).kind === 'gone';
  }

  protected join(): void {
    this.joining.set(true);
    this.api
      .accept(this.token())
      .pipe(finalize(() => this.joining.set(false)))
      .subscribe({
        next: ({ goalId }) => {
          this.toast.success('You joined the goal.');
          void this.router.navigate(['/goals', goalId]);
        },
        error: (err: unknown) => this.toast.error(toApiError(err).message),
      });
  }
}
