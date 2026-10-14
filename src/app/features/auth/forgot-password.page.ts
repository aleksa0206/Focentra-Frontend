import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { FieldControl, FormField } from '../../shared/ui/form-field';

@Component({
  selector: 'app-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormField, FieldControl],
  styleUrl: './auth-pages.scss',
  template: `
    <h1>Forgot password</h1>

    @if (sent()) {
      <p class="auth-notice" role="status">
        If an account with {{ form.controls.email.value }} exists, we've sent a password reset link.
        The link is valid for one hour.
      </p>
      <p class="auth-footer"><a routerLink="/login">Back to sign in</a></p>
    } @else {
      <p class="text-secondary auth-lead">
        Enter your account's email address. We'll send you a link to set a new password.
      </p>
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-field label="Email">
          <input
            class="input"
            appFieldControl
            type="email"
            formControlName="email"
            autocomplete="email"
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
          Send link
        </button>
      </form>
      <p class="auth-footer"><a routerLink="/login">Back to sign in</a></p>
    }
  `,
})
export default class ForgotPasswordPage {
  private readonly auth = inject(AuthService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .requestPasswordReset(this.form.getRawValue().email)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.sent.set(true),
        error: (err: unknown) => this.error.set(toApiError(err).message),
      });
  }
}
