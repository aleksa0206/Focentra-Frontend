import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  inject,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NgControl, ValidationErrors } from '@angular/forms';
import { map, of, startWith, switchMap } from 'rxjs';

let nextId = 0;

function describeError(errors: ValidationErrors): string {
  const [key, value] = Object.entries(errors)[0] ?? [];
  switch (key) {
    case undefined:
      return '';
    case 'required':
      return 'This field is required.';
    case 'email':
      return 'Enter a valid email address.';
    case 'minlength':
      return `At least ${value.requiredLength} characters.`;
    case 'maxlength':
      return `At most ${value.requiredLength} characters.`;
    case 'min':
      return `The minimum allowed value is ${value.min}.`;
    case 'max':
      return `The maximum allowed value is ${value.max}.`;
    case 'pattern':
      return 'The value is not in the correct format.';
    default:
      // Custom validators (and server errors) carry the message as the value.
      return typeof value === 'string' ? value : 'Invalid value.';
  }
}

/**
 * Form field: label, hint and error bound to the control via `appFieldControl`,
 * which sets id, aria-invalid and aria-describedby on the input.
 */
@Component({
  selector: 'app-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field__label" [attr.for]="controlId">
      {{ label() }}
      @if (optional()) {
        <span class="field__optional">(optional)</span>
      }
    </label>
    <ng-content />
    @if (errorMessage(); as message) {
      <p class="field__error" [id]="errorId">{{ message }}</p>
    } @else if (hint()) {
      <p class="field__hint" [id]="hintId">{{ hint() }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      align-content: start;
      gap: 6px;
      min-width: 0;
    }
    .field__label {
      font-size: var(--font-size-secondary);
      font-weight: var(--font-weight-medium);
    }
    .field__optional {
      color: var(--color-text-tertiary);
      font-weight: var(--font-weight-regular);
    }
    .field__hint,
    .field__error {
      font-size: var(--font-size-meta);
      line-height: 16px;
    }
    .field__hint {
      color: var(--color-text-tertiary);
    }
    .field__error {
      color: var(--color-danger);
    }
  `,
})
export class FormField {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  readonly optional = input(false);

  readonly controlId = `field-${++nextId}`;
  readonly errorId = `${this.controlId}-error`;
  readonly hintId = `${this.controlId}-hint`;

  private readonly fieldControl = contentChild(FieldControl);
  private readonly control = computed(() => this.fieldControl()?.ngControl.control ?? null);

  // Controls don't emit signals; `events` covers both touched and validity changes.
  private readonly errors = toSignal(
    toObservable(this.control).pipe(
      switchMap((control: AbstractControl | null) =>
        control
          ? control.events.pipe(
              startWith(null),
              map(() => (control.touched && control.invalid ? control.errors : null)),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  readonly errorMessage = computed(() => {
    const errors = this.errors();
    return errors ? describeError(errors) : '';
  });

  readonly describedBy = computed(() =>
    this.errorMessage() ? this.errorId : this.hint() ? this.hintId : null,
  );
}

@Directive({
  selector: '[appFieldControl]',
  host: {
    '[id]': 'field.controlId',
    '[attr.aria-invalid]': 'field.errorMessage() ? "true" : null',
    '[attr.aria-describedby]': 'field.describedBy()',
  },
})
export class FieldControl {
  protected readonly field = inject(FormField);
  readonly ngControl = inject(NgControl, { self: true });
}
