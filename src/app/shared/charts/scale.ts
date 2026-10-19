import { afterNextRender, DestroyRef, ElementRef, inject, Signal, signal } from '@angular/core';

/** Round axis ticks from 0 up to at least `max`: 0, 2, 4, 6 h rather than 0, 1.7, 3.4. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) {
    return [0, 1];
  }
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!;
  const ticks: number[] = [];
  for (let value = 0; value < max + step; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return ticks;
}

/** Ticks for durations in seconds, stepped in whole hours where possible. */
export function hourTicks(maxSeconds: number, count = 4): number[] {
  const hours = niceTicks(maxSeconds / 3600, count);
  return hours.map((h) => h * 3600);
}

/**
 * Width of the component's host in CSS pixels, kept up to date. Charts draw in real pixels so
 * text stays the same size on a wide panel and on a phone (a scaled viewBox would scale it too).
 */
export function hostWidth(fallback: number): Signal<number> {
  const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  const destroyRef = inject(DestroyRef);
  const width = signal(fallback);
  afterNextRender(() => {
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      if (next > 0) width.set(next);
    });
    observer.observe(host);
    destroyRef.onDestroy(() => observer.disconnect());
  });
  return width.asReadonly();
}
