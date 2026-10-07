import { FormGroup } from '@angular/forms';
import { ApiError } from '../../core/api/api-error';

/**
 * Attaches server validation errors to the matching fields (`details[].path`).
 * Returns `true` if at least one error was shown next to a field; otherwise the caller shows
 * `error.message` above the form.
 */
export function applyServerErrors(form: FormGroup, error: ApiError): boolean {
  let applied = false;
  for (const { path } of error.fieldErrors) {
    const control = form.get(path);
    if (control) {
      control.setErrors({ server: 'The server rejected this value.' });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}
