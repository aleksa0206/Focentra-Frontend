import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { FieldControl, FormField } from '../../shared/ui/form-field';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const confirm = group.get('confirmPassword');
  const mismatch = group.get('newPassword')?.value !== confirm?.value;
  // The error goes on the confirmation field so it shows up below it.
  if (confirm && mismatch !== Boolean(confirm.errors?.['mismatch'])) {
    confirm.setErrors(
      mismatch ? { ...confirm.errors, mismatch: 'The passwords do not match.' } : null,
    );
  }
  return null;
}

@Component({
  selector: 'app-reset-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormField, FieldControl],
  styleUrl: './auth-pages.scss',
  template: `
    <h1>New password</h1>

    @if (!token()) {
      <p class="form-error" role="alert">
        The link is incomplete. Open the link from the email again or request a new one.
      </p>
      <p class="auth-footer"><a routerLink="/forgot-password">Request a new link</a></p>
    } @else if (done()) {
      <p class="auth-notice" role="status">
        Your password has been changed. All existing sessions have been signed out.
      </p>
      <p class="auth-footer"><a routerLink="/login">Sign in</a></p>
    } @else {
      @if (error(); as message) {
        <p class="form-error" role="alert">
          {{ message }}
          @if (tokenRejected()) {
            <a routerLink="/forgot-password">Request a new link</a>
          }
        </p>
      }
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-field label="New password" hint="At least 8 characters.">
          <input
            class="input"
            appFieldControl
            type="password"
            formControlName="newPassword"
            autocomplete="new-password"
          />
        </app-field>
        <app-field label="Repeat password">
          <input
            class="input"
            appFieldControl
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
          />
        </app-field>
        <button
          type="submit"
          class="btn btn--primary auth-submit"
          [disabled]="submitting()"
          [attr.aria-busy]="submitting()"
        >
          @if (submitting()) {
            <span class="spinner" aria-hidden="true"></span>
          }
          Save password
        </button>
      </form>
    }
  `,
})
export default class ResetPasswordPage {
  private readonly auth = inject(AuthService);

  readonly token = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  protected readonly submitting = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tokenRejected = signal(false);

  protected submit(): void {
    const token = this.token();
    if (!token || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .resetPassword(token, this.form.getRawValue().newPassword)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.done.set(true),
        error: (err: unknown) => {
          const apiError = toApiError(err);
          this.tokenRejected.set(apiError.kind === 'unauthorized');
          this.error.set(apiError.message);
        },
      });
  }
}
