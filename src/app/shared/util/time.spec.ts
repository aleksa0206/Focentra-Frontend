import {
  addDays,
  clockText,
  dateKeyIn,
  durationText,
  hoursText,
  weekdayOf,
  zonedInstant,
} from './time';

describe('time utils', () => {
  it('turns a wall-clock time in a zone into the right instant, also across DST', () => {
    // Belgrade is UTC+2 in summer and UTC+1 in winter.
    expect(zonedInstant('2026-07-01', '09:30', 'Europe/Belgrade').toISOString()).toBe(
      '2026-07-01T07:30:00.000Z',
    );
    expect(zonedInstant('2026-11-01', '09:30', 'Europe/Belgrade').toISOString()).toBe(
      '2026-11-01T08:30:00.000Z',
    );
  });

  it('gives the calendar day of an instant in a zone', () => {
    expect(dateKeyIn('2026-10-29T23:30:00Z', 'Europe/Belgrade')).toBe('2026-10-30');
    expect(dateKeyIn('2026-10-29T23:30:00Z', 'America/New_York')).toBe('2026-10-29');
  });

  it('does date arithmetic on keys', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOf('2026-11-02')).toBe(0); // Monday
    expect(weekdayOf('2026-11-08')).toBe(6); // Sunday
  });

  it('formats durations', () => {
    expect(durationText(45)).toBe('45 s');
    expect(durationText(5400)).toBe('1 h 30 min');
    expect(durationText(7200)).toBe('2 h');
    expect(hoursText(5400)).toBe('1.5 h');
    expect(hoursText(40 * 3600)).toBe('40 h');
    expect(clockText(3909)).toBe('1:05:09');
  });
});
