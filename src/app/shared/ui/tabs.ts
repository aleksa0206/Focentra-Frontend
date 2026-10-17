import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  count?: number | undefined;
}

/**
 * Tab list following the ARIA tabs pattern (arrow keys move between tabs). The page owns the
 * selected tab (usually in the URL) and renders the matching panel with `role="tabpanel"`.
 */
@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()" (keydown)="onKeydown($event)">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [id]="idPrefix() + '-tab-' + tab.id"
          [attr.aria-selected]="tab.id === active()"
          [attr.aria-controls]="idPrefix() + '-panel'"
          [tabIndex]="tab.id === active() ? 0 : -1"
          (click)="select.emit(tab.id)"
        >
          {{ tab.label }}
          @if (tab.count) {
            <span class="tab__count">{{ tab.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: var(--space-5);
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0 var(--space-4);
      border-bottom: 1px solid var(--color-border);
    }
    .tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 44px;
      padding: 0;
      border: 0;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--color-text-secondary);
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
    }
    .tab:hover {
      color: var(--color-text);
    }
    .tab[aria-selected='true'] {
      border-bottom-color: var(--color-accent);
      color: var(--color-text);
    }
    .tab__count {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: var(--color-surface-hover);
      color: var(--color-text-secondary);
      font-size: var(--font-size-meta);
      line-height: 18px;
      text-align: center;
    }
  `,
})
export class Tabs {
  readonly tabs = input.required<TabItem[]>();
  readonly active = input.required<string>();
  readonly label = input.required<string>();
  readonly idPrefix = input('tabs');
  readonly select = output<string>();

  protected onKeydown(event: KeyboardEvent): void {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const step = keys[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const tabs = this.tabs();
    const index = tabs.findIndex((tab) => tab.id === this.active());
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (next) {
      this.select.emit(next.id);
      queueMicrotask(() => document.getElementById(`${this.idPrefix()}-tab-${next.id}`)?.focus());
    }
  }
}
