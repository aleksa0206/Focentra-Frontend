import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, of, switchMap, tap, timer } from 'rxjs';
import { TimeEntry } from './api/models';
import { TimeEntriesApi } from './api/resources';
import { pollTriggers } from './polling';

const SYNC_INTERVAL_MS = 60_000;
/** After this long a running timer is probably forgotten (FR-TIME-08). */
export const LONG_RUNNING_SECONDS = 8 * 3600;

/**
 * The one running timer, shown in the top bar on every page. The server keeps `startedAt`, so
 * closing the tab does not stop it; another device's start or stop shows up on the next sync
 * (every minute while the tab is visible, and whenever the tab becomes visible again).
 */
@Injectable({ providedIn: 'root' })
export class TimerService {
  private readonly api = inject(TimeEntriesApi);
  private readonly sync$ = new Subject<void>();
  /** Bumped after every start/stop so pages showing progress can reload. */
  readonly changes = signal(0);

  readonly running = signal<TimeEntry | null>(null);
  /** Ticks every second; for anything that counts live while the timer runs. */
  readonly now = signal(Date.now());

  readonly elapsedSeconds = computed(() => {
    const entry = this.running();
    return entry ? Math.max(0, (this.now() - new Date(entry.startedAt).getTime()) / 1000) : 0;
  });
  readonly longRunning = computed(() => this.elapsedSeconds() >= LONG_RUNNING_SECONDS);

  /**
   * Seconds the running timer added since `loadedAt`. Server totals include the running timer up
   * to the moment they were computed; adding this keeps them counting without reloading.
   */
  sinceLoaded(loadedAt: number): number {
    const entry = this.running();
    if (!entry) {
      return 0;
    }
    const from = Math.max(loadedAt, new Date(entry.startedAt).getTime());
    return Math.max(0, (this.now() - from) / 1000);
  }

  start(destroyRef: DestroyRef): void {
    pollTriggers(SYNC_INTERVAL_MS, this.sync$)
      .pipe(
        switchMap(() => this.api.running().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((res) => {
        if (res) {
          this.setRunning(res.entry);
        }
      });
    // Drives the clock; cheap enough at one tick per second.
    timer(0, 1000)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  startTimer(goalId: number | null, note: string | null = null): Observable<TimeEntry> {
    return this.api.start({ goalId, note }).pipe(tap((entry) => this.setRunning(entry, true)));
  }

  stopTimer(): Observable<TimeEntry> {
    return this.api.stop().pipe(
      tap({
        next: () => this.setRunning(null, true),
        // Already stopped elsewhere: pick up the real state.
        error: () => this.sync$.next(),
      }),
    );
  }

  refresh(): void {
    this.sync$.next();
  }

  private setRunning(entry: TimeEntry | null, changed = false): void {
    const before = this.running();
    this.running.set(entry);
    if (changed || before?.id !== entry?.id) {
      this.changes.update((n) => n + 1);
    }
  }
}
