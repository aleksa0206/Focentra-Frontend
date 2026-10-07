import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { apiUrl, isApiRequest } from '../api/http';
import { AuthService } from './auth.service';

// On these endpoints a 401 is part of the normal flow (wrong password, 2FA code required,
// expired refresh), not an expired session, so they must not trigger a refresh.
const SESSIONLESS_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/2fa/verify-login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
].map(apiUrl);

function withBearer(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url) || SESSIONLESS_AUTH_PATHS.includes(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return next(withBearer(req, auth.token())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return auth.refreshAccessToken().pipe(
        catchError((refreshError: unknown) => {
          auth.expireSession(router.url);
          return throwError(() => refreshError);
        }),
        switchMap((token) => next(withBearer(req, token))),
      );
    }),
  );
};
