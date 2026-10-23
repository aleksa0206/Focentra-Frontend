import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { ToastService } from '../../shared/ui/toast';

type Mode = 'idle' | 'enrolling' | 'disabling';

@Component({
  selector: 'app-two-factor-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormField, FieldControl],
  template: `
    <p class="status">
      Status:
      @if (enabled()) {
        <span class="badge badge--success">Enabled</span>
      } @else {
        <span class="badge">Disabled</span>
      }
    </p>

    @switch (mode()) {
      @case ('idle') {
        <p class="text-secondary">
          @if (enabled()) {
            Signing in requires a code from your authenticator app in addition to your password.
          } @else {
            Extra protection for your account: signing in also asks for a code from an app such as
            Google Authenticator or 1Password.
          }
        </p>
        <div class="actions">
          @if (enabled()) {
            <button type="button" class="btn" (click)="startDisable()">Disable</button>
          } @else {
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="busy()"
              (click)="startEnroll()"
            >
              Enable
            </button>
          }
        </div>
      }
      @case ('enrolling') {
        <ol class="steps">
          <li>Scan the QR code with your authenticator app.</li>
          <li>Enter the six-digit code the app shows.</li>
        </ol>
        @if (qrCode(); as src) {
          <img
            class="qr"
            [src]="src"
            alt="QR code for setting up two-factor authentication"
            width="180"
            height="180"
          />
        }
      }
    }

    @if (mode() !== 'idle') {
      <form class="code-form" [formGroup]="form" (ngSubmit)="submitCode()" novalidate>
        @if (error(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
        <app-field
          [label]="mode() === 'disabling' ? 'Code to confirm disabling' : 'Code from the app'"
        >
          <input
            class="input code"
            appFieldControl
            formControlName="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
          />
        </app-field>
        <div class="actions">
          <button
            type="submit"
            class="btn"
            [class.btn--primary]="mode() === 'enrolling'"
            [disabled]="busy()"
          >
            {{ mode() === 'disabling' ? 'Disable 2FA' : 'Confirm and enable' }}
          </button>
          <button type="button" class="btn btn--ghost" (click)="cancel()">Cancel</button>
        </div>
      </form>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }
    .status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .actions {
      display: flex;
      gap: var(--space-2);
    }
    .steps {
      display: grid;
      gap: var(--space-1);
      padding-left: var(--space-5);
      list-style: decimal;
    }
    .qr {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }
    .code-form {
      display: grid;
      gap: var(--space-3);
      max-width: 280px;
    }
    .code {
      font-family: var(--font-family-mono);
      letter-spacing: 0.3em;
    }
  `,
})
export class TwoFactorSettings {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly enabled = computed(() => this.auth.user()?.twoFactorEnabled ?? false);
  protected readonly mode = signal<Mode>('idle');
  protected readonly qrCode = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected startEnroll(): void {
    this.run(this.auth.setupTwoFactor(), ({ qrCode }) => {
      this.qrCode.set(qrCode);
      this.mode.set('enrolling');
    });
  }

  protected startDisable(): void {
    this.mode.set('disabling');
  }

  protected submitCode(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { code } = this.form.getRawValue();
    const enrolling = this.mode() === 'enrolling';
    const request$ = enrolling
      ? this.auth.confirmTwoFactor(code)
      : this.auth.disableTwoFactor(code);
    this.run(request$, () => {
      this.toast.success(
        enrolling
          ? 'Two-factor authentication is enabled.'
          : 'Two-factor authentication is disabled.',
      );
      this.cancel();
    });
  }

  protected cancel(): void {
    this.mode.set('idle');
    this.qrCode.set(null);
    this.error.set(null);
    this.form.reset();
  }

  private run<T>(request$: Observable<T>, onSuccess: (value: T) => void): void {
    this.busy.set(true);
    this.error.set(null);
    request$.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: onSuccess,
      error: (err: unknown) => {
        const message = toApiError(err).message;
        // Outside the code form (e.g. setup failed to start) there is nowhere else to show the error.
        if (this.mode() === 'idle') {
          this.toast.error(message);
        } else {
          this.error.set(message);
        }
      },
    });
  }
}
