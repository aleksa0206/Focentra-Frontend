import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { toApiError } from '../api/api-error';
import { apiUrl } from '../api/http';
import { User } from '../api/models';

interface TokenResponse {
  token: string;
}

interface SessionResponse extends TokenResponse {
  user: User;
}

export type LoginOutcome =
  { status: 'authenticated' } | { status: 'twoFactorRequired'; tempToken: string };

// The refresh token is an httpOnly cookie scoped to /auth; it is only sent with withCredentials,
// and only to the endpoints that read or set it.
const WITH_COOKIE = { withCredentials: true } as const;

/** The browser's zone, used as the default for new accounts. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // The access token deliberately lives only in memory: after a page reload the session is
  // restored via the refresh cookie, and the token never touches localStorage (XSS).
  private readonly accessToken = signal<string | null>(null);
  private readonly currentUser = signal<User | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  /** Every date and time on screen is shown in this zone. */
  readonly timeZone = computed(() => this.currentUser()?.timezone ?? browserTimeZone());

  token(): string | null {
    return this.accessToken();
  }

  login(email: string, password: string): Observable<LoginOutcome> {
    return this.http
      .post<SessionResponse>(apiUrl('/auth/login'), { email, password }, WITH_COOKIE)
      .pipe(
        tap((res) => this.startSession(res)),
        map((): LoginOutcome => ({ status: 'authenticated' })),
        catchError((error: unknown) => {
          const apiError = toApiError(error);
          const tempToken = apiError.body['tempToken'];
          return apiError.code === 'TWO_FACTOR_REQUIRED' && typeof tempToken === 'string'
            ? of<LoginOutcome>({ status: 'twoFactorRequired', tempToken })
            : throwError(() => error);
        }),
      );
  }

  verifyTwoFactorLogin(tempToken: string, code: string): Observable<void> {
    return this.http
      .post<SessionResponse>(apiUrl('/auth/2fa/verify-login'), { tempToken, code }, WITH_COOKIE)
      .pipe(map((res) => this.startSession(res)));
  }

  /** The user signs in through the emailed link. */
  register(input: { name: string; email: string; password: string }): Observable<void> {
    return this.http.post<void>(apiUrl('/auth/register'), {
      ...input,
      timezone: browserTimeZone(),
    });
  }

  /** The emailed link both confirms the address and signs the user in. */
  verifyEmail(token: string): Observable<void> {
    return this.http
      .post<SessionResponse>(apiUrl('/auth/verify-email'), { token }, WITH_COOKIE)
      .pipe(map((res) => this.startSession(res)));
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(apiUrl('/auth/resend-verification'), { email });
  }

  /** Called once on app start; failure only means the user is not signed in. */
  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.refreshAccessToken().pipe(
        switchMap(() => this.reloadCurrentUser()),
        map(() => undefined),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      ),
    );
  }

  /**
   * The backend rotates the refresh token atomically, so a second concurrent refresh with the
   * same cookie would fail. All parallel 401 responses therefore wait for the same request.
   */
  refreshAccessToken(): Observable<string> {
    this.refreshInFlight ??= this.http
      .post<TokenResponse>(apiUrl('/auth/refresh'), null, WITH_COOKIE)
      .pipe(
        map((res) => res.token),
        tap((token) => this.accessToken.set(token)),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay(1),
      );
    return this.refreshInFlight;
  }

  reloadCurrentUser(): Observable<User> {
    return this.http.get<User>(apiUrl('/auth/me')).pipe(tap((user) => this.currentUser.set(user)));
  }

  logout(): void {
    this.http
      .post<void>(apiUrl('/auth/logout'), null, WITH_COOKIE)
      .pipe(catchError(() => of(undefined)))
      .subscribe(() => this.endSession());
  }

  /** After the account is deleted or the session ended elsewhere. */
  endSession(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  /** Ends the session locally (e.g. when refresh fails); the server-side token is already invalid. */
  expireSession(returnUrl: string): void {
    this.clearSession();
    void this.router.navigate(['/login'], { queryParams: { returnUrl, expired: 1 } });
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(apiUrl('/auth/forgot-password'), { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(apiUrl('/auth/reset-password'), { token, newPassword });
  }

  setupTwoFactor(): Observable<{ qrCode: string; secret: string }> {
    return this.http.post<{ qrCode: string; secret: string }>(apiUrl('/auth/2fa/setup'), null);
  }

  confirmTwoFactor(code: string): Observable<void> {
    return this.http
      .post<void>(apiUrl('/auth/2fa/confirm'), { code })
      .pipe(tap(() => this.patchCurrentUser({ twoFactorEnabled: true })));
  }

  disableTwoFactor(code: string): Observable<void> {
    return this.http
      .delete<void>(apiUrl('/auth/2fa'), { body: { code } })
      .pipe(tap(() => this.patchCurrentUser({ twoFactorEnabled: false })));
  }

  patchCurrentUser(changes: Partial<User>): void {
    this.currentUser.update((user) => (user ? { ...user, ...changes } : user));
  }

  private startSession(res: SessionResponse): void {
    this.accessToken.set(res.token);
    this.currentUser.set(res.user);
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
  }
}
