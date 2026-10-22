import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize, of } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { CreatedInvite, GoalDetail } from '../../core/api/models';
import { MembersApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast';
import { dateTimeLabel } from '../../shared/util/time';

/**
 * Members of a goal and, for the owner, invite links. Anyone with a link can join after signing
 * in, and then sees every entry on this goal (and nothing else of the owner's).
 */
@Component({
  selector: 'app-goal-sharing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <section class="panel" aria-labelledby="sharing-title">
      <div class="panel__header">
        <h2 class="panel__title" id="sharing-title">
          Members
          <span class="panel__count">{{ members.value()?.length ?? goal().memberCount }}</span>
        </h2>
        @if (isOwner() && !goal().archived) {
          <button type="button" class="btn btn--sm" [disabled]="busy()" (click)="createInvite()">
            <app-icon name="link" [size]="14" />
            Invite link
          </button>
        }
      </div>
      <div class="panel__body sharing">
        @if (created(); as invite) {
          <div class="alert alert--info" role="status">
            <app-icon name="info" />
            <div class="sharing__invite">
              <span>
                Share this link. It works for 7 days, for anyone who signs in, until you revoke it.
                It is shown only now.
              </span>
              <div class="sharing__link">
                <input class="input" readonly [value]="link(invite)" aria-label="Invite link" />
                <button type="button" class="btn btn--sm" (click)="copy(invite)">
                  <app-icon name="copy" [size]="14" />
                  Copy
                </button>
              </div>
            </div>
          </div>
        }

        <ul class="sharing__members">
          @for (member of members.value() ?? []; track member.userId) {
            <li>
              <span>
                {{ member.name }}
                @if (member.userId === me()) {
                  <span class="text-meta">(you)</span>
                }
              </span>
              <span class="text-meta">{{ member.role === 'OWNER' ? 'Owner' : 'Member' }}</span>
              @if (isOwner() && member.role !== 'OWNER') {
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  [attr.aria-label]="'Remove ' + member.name"
                  (click)="remove(member.userId, member.name)"
                >
                  Remove
                </button>
              }
            </li>
          }
        </ul>

        @if (isOwner() && (invites.value()?.length ?? 0) > 0) {
          <h3 class="text-secondary sharing__subtitle">Active invite links</h3>
          <ul class="sharing__members">
            @for (invite of invites.value(); track invite.id) {
              <li>
                <span>Created {{ when(invite.createdAt) }}</span>
                <span class="text-meta">expires {{ when(invite.expiresAt) }}</span>
                <button type="button" class="btn btn--ghost btn--sm" (click)="revoke(invite.id)">
                  Revoke
                </button>
              </li>
            }
          </ul>
        }

        @if (!isOwner()) {
          <button type="button" class="btn btn--sm" (click)="leave()">Leave goal</button>
        }
      </div>
    </section>
  `,
  styles: `
    .sharing {
      display: grid;
      gap: var(--space-3);
    }
    .sharing__invite {
      display: grid;
      gap: var(--space-2);
      width: 100%;
    }
    .sharing__link {
      display: flex;
      gap: var(--space-2);
    }
    .sharing__members {
      display: grid;
      li {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: center;
        gap: var(--space-3);
        min-height: 36px;
        border-bottom: 1px solid var(--color-border);
      }
      li:last-child {
        border-bottom: 0;
      }
    }
    .sharing__subtitle {
      margin-top: var(--space-2);
      font-size: var(--font-size-secondary);
      font-weight: var(--font-weight-medium);
    }
  `,
})
export class GoalSharing {
  readonly goal = input.required<GoalDetail>();
  /** Membership changed (someone removed, or the user left). */
  readonly changed = output<'members' | 'left'>();

  private readonly api = inject(MembersApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly clipboard = inject(Clipboard);

  protected readonly busy = signal(false);
  protected readonly created = signal<CreatedInvite | null>(null);
  protected readonly isOwner = computed(() => this.goal().role === 'OWNER');
  protected readonly me = computed(() => this.auth.user()?.id);

  protected readonly members = rxResource({
    params: () => this.goal().id,
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly invites = rxResource({
    params: () => (this.isOwner() ? this.goal().id : null),
    stream: ({ params }) => (params ? this.api.invites(params) : of([])),
  });

  protected when(instant: string): string {
    return dateTimeLabel(instant, this.auth.timeZone());
  }

  protected link(invite: CreatedInvite): string {
    return `${location.origin}/invites/${invite.token}`;
  }

  protected createInvite(): void {
    this.busy.set(true);
    this.api
      .createInvite(this.goal().id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (invite) => {
          this.created.set(invite);
          this.invites.reload();
        },
        error: (err: unknown) => this.toast.error(toApiError(err).message),
      });
  }

  protected copy(invite: CreatedInvite): void {
    if (this.clipboard.copy(this.link(invite))) {
      this.toast.success('Link copied.');
    }
  }

  protected revoke(inviteId: number): void {
    this.api.revokeInvite(this.goal().id, inviteId).subscribe({
      next: () => {
        this.toast.success('Invite link revoked.');
        this.invites.reload();
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected async remove(userId: number, name: string): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Remove ${name}?`,
      message: `${name} loses access to this goal. Their time stays in their own log but no longer counts here.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    this.api.remove(this.goal().id, userId).subscribe({
      next: () => {
        this.toast.success(`${name} removed.`);
        this.members.reload();
        this.changed.emit('members');
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected async leave(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Leave this goal?',
      message:
        'Your time stays in your own log but stops counting toward this goal, and your logged units on it are deleted. You need a new invite to come back.',
      confirmLabel: 'Leave',
      tone: 'danger',
    });
    if (!ok) return;
    this.api.remove(this.goal().id, this.me()!).subscribe({
      next: () => {
        this.toast.success('You left the goal.');
        this.changed.emit('left');
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }
}
