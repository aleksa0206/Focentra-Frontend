import { HttpErrorResponse } from '@angular/common/http';

export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'gone'
  | 'locked'
  | 'rateLimited'
  | 'network'
  | 'server';

export interface FieldError {
  path: string;
  message: string;
}

/**
 * Normalized error: `message` is always safe to show to the user, with no internal details.
 * `code` is the backend's machine-readable reason (e.g. TIMER_ALREADY_RUNNING), when it sent one.
 */
export class ApiError {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    readonly message: string,
    readonly code: string | null = null,
    readonly fieldErrors: FieldError[] = [],
    readonly body: Record<string, unknown> = {},
  ) {}
}

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  validation: 'Some of the data is invalid. Check the highlighted fields.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have permission to do this.",
  notFound: 'The requested item does not exist or has been deleted.',
  conflict: "This action isn't possible right now.",
  gone: 'This link is no longer valid.',
  locked: 'The account is temporarily locked.',
  rateLimited: 'Too many requests. Wait a few minutes and try again.',
  network: "The server can't be reached. Check your connection and try again.",
  server: 'Something went wrong on the server. Please try again later.',
};

// The backend's `code` decides the text; messages are written for developers.
const CODE_MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: 'An account with this email already exists. Sign in instead.',
  EMAIL_NOT_VERIFIED: 'Confirm your email address first. Check your inbox.',
  ACCOUNT_LOCKED:
    'The account is temporarily locked after too many failed attempts. Try again in 15 minutes.',
  WRONG_PASSWORD: 'The password is incorrect.',
  TIMER_ALREADY_RUNNING: 'A timer is already running. Stop it first.',
  NO_TIMER_RUNNING: 'The timer was already stopped, maybe on another device.',
  ENTRY_OVERLAP: 'This overlaps another entry.',
  GOAL_ARCHIVED: 'This goal is archived. Restore it to log time on it.',
  NOT_GOAL_OWNER: 'Only the owner of the goal can do this.',
  OWNER_CANNOT_LEAVE: 'The owner cannot leave the goal. Delete it instead.',
  GOAL_FULL: 'This goal already has the maximum of 20 members.',
  INVITE_INVALID: 'This invite link is invalid or has expired. Ask for a new one.',
  RATE_LIMITED: DEFAULT_MESSAGES.rateLimited,
};

// For responses without a specific code.
const KNOWN_MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/^Invalid email or password$/, 'Incorrect email or password.'],
  [/^Invalid two-factor code$/, 'The code is incorrect. Check your authenticator app.'],
  [/temporary token/i, 'The sign-in has expired. Enter your email and password again.'],
  [/reset token/i, 'The password reset link is invalid or has expired. Request a new one.'],
  [/verification link/, 'The activation link is invalid or has expired. Request a new one below.'],
  [/already enabled/, 'Two-factor authentication is already on.'],
];

function kindFromStatus(status: number): ApiErrorKind {
  switch (status) {
    case 0:
      return 'network';
    case 400:
    case 413:
      return 'validation';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 409:
      return 'conflict';
    case 410:
      return 'gone';
    case 423:
      return 'locked';
    case 429:
      return 'rateLimited';
    default:
      return 'server';
  }
}

function userMessage(code: string | null, backendMessage: unknown, kind: ApiErrorKind): string {
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }
  if (typeof backendMessage === 'string' && kind !== 'server') {
    for (const [pattern, replacement] of KNOWN_MESSAGES) {
      if (pattern.test(backendMessage)) {
        return replacement;
      }
    }
    // Validation messages name the field and rule ("deadline: must not be before the start date")
    // and contain nothing internal, so they are fine to show.
    if (kind === 'validation') {
      return backendMessage;
    }
  }
  return DEFAULT_MESSAGES[kind];
}

function isFieldErrorList(value: unknown): value is FieldError[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item?.path === 'string' && typeof item?.message === 'string')
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError('server', -1, DEFAULT_MESSAGES.server);
  }

  const kind = kindFromStatus(error.status);
  const body: Record<string, unknown> =
    typeof error.error === 'object' && error.error !== null ? error.error : {};
  const code = typeof body['code'] === 'string' ? body['code'] : null;

  return new ApiError(
    kind,
    error.status,
    userMessage(code, body['error'], kind),
    code,
    isFieldErrorList(body['details']) ? body['details'] : [],
    body,
  );
}
