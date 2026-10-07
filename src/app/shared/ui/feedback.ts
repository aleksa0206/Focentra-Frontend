import { ChangeDetectionStrategy, Component, input, numberAttribute, output } from '@angular/core';
import { ApiError, toApiError } from '../../core/api/api-error';
import { Icon, IconName } from './icon';

/** Empty state: explains why there is no data and (via ng-content) what the user can do next. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <app-icon [name]="icon()" [size]="20" />
    <p class="empty__title">{{ title() }}</p>
    @if (description()) {
      <p class="text-secondary">{{ description() }}</p>
    }
    <div class="empty__actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--space-1);
      padding: var(--space-10) var(--space-4);
      text-align: center;
      color: var(--color-text-tertiary);
    }
    .empty__title {
      margin-top: var(--space-2);
      color: var(--color-text);
      font-weight: var(--font-weight-medium);
    }
    .empty__actions:not(:empty) {
      margin-top: var(--space-3);
    }
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly icon = input<IconName>('inbox');
}

/** Load error with retry. No retry for 403/404, since retrying won't help. */
@Component({
  selector: 'app-load-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <app-icon name="alert" [size]="20" />
    <p>{{ apiError().message }}</p>
    @if (apiError().kind !== 'forbidden' && apiError().kind !== 'notFound') {
      <button type="button" class="btn btn--sm" (click)="retry.emit()">Try again</button>
    }
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      text-align: center;
      color: var(--color-text-secondary);
    }
    app-icon {
      color: var(--color-danger);
    }
  `,
})
export class LoadError {
  readonly error = input.required<unknown>();
  readonly retry = output();
  protected apiError(): ApiError {
    return toApiError(this.error());
  }
}

/** Skeleton rows inside an existing <tbody>, so the table doesn't jump while loading. */
@Component({
  selector: 'tbody[appSkeletonRows]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (row of rowsArray(); track $index) {
      <tr aria-hidden="true">
        @for (col of columnsArray(); track $index) {
          <td><span class="skeleton" [style.width.%]="60 + (($index * 17) % 35)"></span></td>
        }
      </tr>
    }
  `,
})
export class SkeletonRows {
  readonly columns = input.required({ transform: numberAttribute });
  readonly rows = input(5, { transform: numberAttribute });
  protected rowsArray(): null[] {
    return Array(this.rows()).fill(null);
  }
  protected columnsArray(): null[] {
    return Array(this.columns()).fill(null);
  }
}
