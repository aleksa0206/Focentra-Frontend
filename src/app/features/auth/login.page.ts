import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { FieldControl, FormField } from '../../shared/ui/form-field';
import { safeReturnUrl } from './return-url';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormField, FieldControl],
  templateUrl: './login.page.html',
  styleUrl: './auth-pages.scss',
})
export default class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly returnUrl = input<string>();
  readonly expired = input<string>();

  protected readonly step = signal<'credentials' | 'code'>('credentials');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The password was right but the email was never confirmed (the only 403 login returns). */
  protected readonly unverified = signal(false);
  private tempToken = '';

  protected readonly credentials = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected submitCredentials(): void {
    if (this.credentials.invalid) {
      this.credentials.markAllAsTouched();
      return;
    }
    const { email, password } = this.credentials.getRawValue();
    this.run(this.auth.login(email, password), (outcome) => {
      if (outcome.status === 'twoFactorRequired') {
        this.tempToken = outcome.tempToken;
        this.step.set('code');
      } else {
        this.enterApp();
      }
    });
  }

  protected submitCode(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.run(this.auth.verifyTwoFactorLogin(this.tempToken, this.codeForm.getRawValue().code), () =>
      this.enterApp(),
    );
  }

  protected backToCredentials(): void {
    this.step.set('credentials');
    this.codeForm.reset();
    this.error.set(null);
  }

  private run<T>(request: Observable<T>, onSuccess: (value: T) => void): void {
    this.submitting.set(true);
    this.error.set(null);
    this.unverified.set(false);
    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: onSuccess,
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.error.set(apiError.message);
        this.unverified.set(apiError.code === 'EMAIL_NOT_VERIFIED');
      },
    });
  }

  private enterApp(): void {
    void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
  }
}
