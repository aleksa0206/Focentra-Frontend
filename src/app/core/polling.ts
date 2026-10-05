import { filter, fromEvent, merge, Observable, of, timer } from 'rxjs';

const isVisible = () => document.visibilityState === 'visible';

/**
 * When to re-fetch a small piece of live data (badges) without a push channel: immediately,
 * on every interval while the tab is visible, as soon as the tab becomes visible again, and
 * whenever `manual$` emits (e.g. right after the user changed something).
 */
export function pollTriggers(
  intervalMs: number,
  manual$: Observable<unknown>,
): Observable<unknown> {
  return merge(
    of(null),
    timer(intervalMs, intervalMs).pipe(filter(isVisible)),
    fromEvent(document, 'visibilitychange').pipe(filter(isVisible)),
    manual$,
  );
}
