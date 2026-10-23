import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AccountApi } from '../../core/api/resources';
import { AuthService } from '../../core/auth/auth.service';
import { TimerService } from '../../core/timer.service';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast';
import { applyServerErrors } from '../../shared/util/forms';
import { timeZones } from '../../shared/util/time';
import { TwoFactorSettings } from './two-factor-settings';

@Component({
  selector: 'app-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, FormField, FieldControl, TwoFactorSettings, Icon],
  template: `
    <div class="page page--narrow">
      <app-page-header title="My account" />

      <section class="section">
        <h2 class="section__heading">Profile</h2>
        <form class="form" [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate>
          @if (profileError(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }
          <app-field label="Name" hint="Shown to people you share a goal with.">
            <input class="input" appFieldControl formControlName="name" autocomplete="name" />
          </app-field>
          <app-field
            label="Time zone"
            hint="Your days, weeks and statistics are counted in this zone. Goals keep the zone they were created in."
          >
            <select class="select" appFieldControl formControlName="timezone">
              @for (zone of zones; track zone) {
                <option [value]="zone">{{ zone }}</option>
              }
            </select>
          </app-field>
          <div class="form__actions">
            <button
              type="submit"
              class="btn btn--primary"
              [disabled]="saving() || profile.pristine"
              [attr.aria-busy]="saving()"
            >
              Save
            </button>
          </div>
        </form>
      </section>

      <section class="section">
        <h2 class="section__heading">Password</h2>
        <p class="text-secondary">
          The password is changed via a link sent by email: sign out and choose "Forgot your
          password?".
        </p>
      </section>

      <section class="section">
        <h2 class="section__heading">Two-factor authentication</h2>
        <app-two-factor-settings />
      </section>

      <section class="section">
        <h2 class="section__heading">Your data</h2>
        <p class="text-secondary">Download everything you tracked as a JSON file.</p>
        <button type="button" class="btn section__action" (click)="download()">
          <app-icon name="download" [size]="14" />
          Export data
        </button>
      </section>

      <section class="section danger-zone">
        <h2 class="section__heading">Delete account</h2>
        <p class="text-secondary">
          Deletes your account, your time and your goals, also for the people you share them with.
          This cannot be undone.
        </p>
        <form
          class="form section__action"
          [formGroup]="deletion"
          (ngSubmit)="deleteAccount()"
          novalidate
        >
          @if (deleteError(); as message) {
            <p class="form-error" role="alert">{{ message }}</p>
          }
          <app-field label="Confirm with your password">
            <input
              class="input"
              appFieldControl
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
          </app-field>
          <div class="form__actions">
            <button
              type="submit"
              class="btn btn--danger"
              [disabled]="deleting()"
              [attr.aria-busy]="deleting()"
            >
              Delete my account
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: `
    .section__heading {
      margin-bottom: var(--space-3);
    }
    .section__action {
      margin-top: var(--space-3);
    }
  `,
})
export default class AccountPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AccountApi);
  private readonly timer = inject(TimerService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly zones = timeZones();
  protected readonly profile = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    timezone: ['UTC', Validators.required],
  });
  protected readonly deletion = this.fb.group({ password: ['', Validators.required] });
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user && this.profile.pristine) {
        this.profile.reset({ name: user.name, timezone: user.timezone });
      }
    });
  }

  protected saveProfile(): void {
    this.profileError.set(null);
    if (this.profile.invalid) {
      this.profile.markAllAsTouched();
      return;
    }
    const body = this.profile.getRawValue();
    this.saving.set(true);
    this.api
      .update(body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.auth.patchCurrentUser(updated);
          this.profile.reset(body);
          // Days and weeks move with the zone.
          this.timer.refresh();
          this.toast.success('Profile saved.');
        },
        error: (err: unknown) => {
          const apiError = toApiError(err);
          if (!applyServerErrors(this.profile, apiError)) {
            this.profileError.set(apiError.message);
          }
        },
      });
  }

  protected download(): void {
    this.api.export().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'focentra-export.json';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (err: unknown) => this.toast.error(toApiError(err).message),
    });
  }

  protected deleteAccount(): void {
    this.deleteError.set(null);
    if (this.deletion.invalid) {
      this.deletion.markAllAsTouched();
      return;
    }
    this.deleting.set(true);
    this.api
      .remove(this.deletion.getRawValue().password)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Your account has been deleted.');
          this.auth.endSession();
        },
        error: (err: unknown) => this.deleteError.set(toApiError(err).message),
      });
  }
}
