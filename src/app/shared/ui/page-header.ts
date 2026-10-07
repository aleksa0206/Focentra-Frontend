import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    @if (backLink(); as link) {
      <a class="page-header__back" [routerLink]="link">
        <app-icon name="chevronLeft" [size]="14" />
        {{ backLabel() }}
      </a>
    }
    <div class="page-header__row">
      <div class="page-header__text">
        <h1>{{ title() }}</h1>
        @if (description()) {
          <p class="text-secondary">{{ description() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--space-6);
    }
    .page-header__back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      margin-bottom: var(--space-2);
      font-size: var(--font-size-secondary);
      color: var(--color-text-secondary);
    }
    .page-header__row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .page-header__text {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .page-header__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly backLink = input<string>();
  readonly backLabel = input('Back');
}
