import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { FieldControl, FormField } from '../../shared/ui/form-field';

@Component({
  selector: 'app-verify-email-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormField, FieldControl],
  styleUrl: './auth-pages.scss',
  template: `
    <h1>Confirm your email</h1>

    @if (verifying()) {
      <p class="text-secondary auth-lead" role="status">
        <span class="spinner" aria-hidden="true"></span> Confirming your email…
      </p>
    } @else if (sent()) {
      <p class="auth-notice" role="status">
        If {{ form.controls.email.value }} still needs confirming, we've sent a new link. It is
        valid for 24 hours.
      </p>
      <p class="auth-footer"><a routerLink="/login">Back to sign in</a></p>
    } @else {
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      } @else {
        <p class="text-secondary auth-lead">
          Enter the email you signed up with and we'll send a new activation link.
        </p>
      }
      <form class="auth-form" [formGroup]="form" (ngSubmit)="resend()" novalidate>
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
          Send new link
        </button>
      </form>
      <p class="auth-footer"><a routerLink="/login">Back to sign in</a></p>
    }
  `,
})
export default class VerifyEmailPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly token = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly verifying = signal(false);
  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      return;
    }
    this.verifying.set(true);
    this.auth
      .verifyEmail(token)
      .pipe(finalize(() => this.verifying.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/'),
        error: (err: unknown) => this.error.set(toApiError(err).message),
      });
  }

  protected resend(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .resendVerification(this.form.getRawValue().email)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.sent.set(true),
        error: (err: unknown) => this.error.set(toApiError(err).message),
      });
  }
}
