import { GoalProgress } from '../../core/api/models';
import { niceTicks } from '../charts/scale';
import { goalValueText, paceSentence, progressRatio } from './goal-format';

const timeGoal = { type: 'TIME' as const, unit: null };
const progress = (
  value: number,
  expected: number,
  status: GoalProgress['status'],
): GoalProgress => ({
  windowStart: '',
  windowEnd: '',
  value,
  target: 40 * 3600,
  expected,
  status,
});

describe('goal formatting', () => {
  it('says how far behind or ahead the plan is (US-03)', () => {
    expect(paceSentence(timeGoal, progress(14 * 3600, 20 * 3600, 'BEHIND'))).toBe(
      '6 h behind the plan.',
    );
    expect(paceSentence(timeGoal, progress(23 * 3600, 20 * 3600, 'AHEAD'))).toBe(
      '3 h ahead of the plan.',
    );
    expect(paceSentence(timeGoal, progress(40 * 3600, 20 * 3600, 'COMPLETED'))).toBe(
      'Target reached.',
    );
  });

  it('writes values in the goal unit', () => {
    expect(goalValueText({ type: 'COUNT', unit: 'pages' }, 1200)).toBe('1,200 pages');
    expect(goalValueText(timeGoal, 5400, true)).toBe('1 h 30 min');
  });

  it('caps the progress bar at 100 %', () => {
    expect(progressRatio({ value: 50, target: 40 })).toBe(1);
    expect(progressRatio({ value: 10, target: 0 })).toBe(0);
  });

  it('picks round axis ticks', () => {
    expect(niceTicks(17)).toEqual([0, 5, 10, 15, 20]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
