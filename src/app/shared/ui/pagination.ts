import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PaginationMeta } from '../../core/api/models';
import { Icon } from './icon';

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (meta(); as m) {
      <nav class="pagination" aria-label="Pagination">
        <span class="text-secondary">{{ range() }}</span>
        @if (m.totalPages > 1) {
          <div class="pagination__buttons">
            <button
              type="button"
              class="btn btn--sm"
              [disabled]="m.page <= 1"
              (click)="pageChange.emit(m.page - 1)"
            >
              <app-icon name="chevronLeft" [size]="14" />
              Previous
            </button>
            <span class="text-secondary">Page {{ m.page }} of {{ m.totalPages }}</span>
            <button
              type="button"
              class="btn btn--sm"
              [disabled]="m.page >= m.totalPages"
              (click)="pageChange.emit(m.page + 1)"
            >
              Next
              <app-icon name="chevronRight" [size]="14" />
            </button>
          </div>
        }
      </nav>
    }
  `,
  styles: `
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--space-3);
      padding-top: var(--space-3);
    }
    .pagination__buttons {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
  `,
})
export class Pagination {
  readonly meta = input.required<PaginationMeta | undefined>();
  readonly pageChange = output<number>();

  protected readonly range = computed(() => {
    const m = this.meta();
    if (!m || m.total === 0) {
      return '';
    }
    const from = (m.page - 1) * m.limit + 1;
    const to = Math.min(m.page * m.limit, m.total);
    return `${from}–${to} of ${m.total}`;
  });
}
