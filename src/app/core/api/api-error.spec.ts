import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

const http = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('toApiError', () => {
  it('maps the backend code to a user message and keeps the extra fields', () => {
    const error = toApiError(
      http(409, {
        error: 'This overlaps another entry',
        code: 'ENTRY_OVERLAP',
        overlapping: { id: 3 },
      }),
    );
    expect(error.kind).toBe('conflict');
    expect(error.code).toBe('ENTRY_OVERLAP');
    expect(error.message).toBe('This overlaps another entry.');
    expect(error.body['overlapping']).toEqual({ id: 3 });
  });

  it('never shows server internals', () => {
    expect(toApiError(http(500, { error: 'PrismaClientKnownRequestError at ...' })).message).toBe(
      'Something went wrong on the server. Please try again later.',
    );
  });

  it('treats 410 as an expired link', () => {
    expect(toApiError(http(410, { code: 'INVITE_INVALID' })).kind).toBe('gone');
  });

  it('keeps field errors from validation responses', () => {
    const error = toApiError(
      http(400, {
        error: 'deadline: must not be before the start date',
        details: [{ path: 'deadline', message: 'x' }],
      }),
    );
    expect(error.fieldErrors).toEqual([{ path: 'deadline', message: 'x' }]);
    expect(error.message).toBe('deadline: must not be before the start date');
  });
});
