// Formatting and parsing in the user's profile zone (not necessarily the browser's), so the app
// shows the same days and hours as the backend computes its statistics in.
import { TZDate } from '@date-fns/tz';
import { DateKey } from '../../core/api/models';

const LOCALE = 'en-GB';

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
}

/** Calendar date of an instant in a zone. */
export function dateKeyIn(instant: Date | string, timeZone: string): DateKey {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(instant));
}

export function todayKey(timeZone: string): DateKey {
  return dateKeyIn(new Date(), timeZone);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayOf(key: DateKey): number {
  return (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** The instant a wall-clock time (`HH:mm`) on a date happens in a zone. */
export function zonedInstant(key: DateKey, time: string, timeZone: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, hh, mm, timeZone).getTime());
}

/** `HH:mm` of an instant in a zone. */
export function timeOfDay(instant: Date | string, timeZone: string): string {
  return formatter(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(instant),
  );
}

/** "Mon 3 Nov" or, outside the current year, "3 Nov 2025". */
export function dayLabel(key: DateKey, withWeekday = true): string {
  const date = new Date(`${key}T12:00:00Z`);
  const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  return formatter('UTC', {
    ...(withWeekday && { weekday: 'short' }),
    day: 'numeric',
    month: 'short',
    ...(!sameYear && { year: 'numeric' }),
  }).format(date);
}

/** "3 Nov 2026" */
export function longDate(key: DateKey): string {
  return formatter('UTC', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${key}T12:00:00Z`),
  );
}

/** "3 Nov, 14:05" in a zone. */
export function dateTimeLabel(instant: string, timeZone: string): string {
  return formatter(timeZone, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
}

/** 5400 → "1 h 30 min", 45 → "45 s" only when under a minute. */
export function durationText(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) {
    return `${total} s`;
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** 5400 → "1.5 h" (for targets and charts). */
export function hoursText(seconds: number): string {
  const hours = seconds / 3600;
  const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return `${rounded} h`;
}

/** Running timer display: "1:05:09". */
export function clockText(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Every IANA zone the browser knows, for the profile select. */
export function timeZones(): string[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported('timeZone') : [];
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}
