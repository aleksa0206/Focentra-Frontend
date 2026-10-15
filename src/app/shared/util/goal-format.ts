import { Pipe, PipeTransform } from '@angular/core';
import { Goal, GoalProgress, PaceStatus } from '../../core/api/models';
import { durationText, hoursText, longDate } from './time';

type GoalLike = Pick<Goal, 'type' | 'unit'>;

/** A goal's value in its own unit: "12 h" or "120 pages". */
export function goalValueText(goal: GoalLike, value: number, precise = false): string {
  if (goal.type === 'TIME') {
    return precise ? durationText(value) : hoursText(value);
  }
  return `${value.toLocaleString('en-GB')} ${goal.unit ?? ''}`.trim();
}

@Pipe({ name: 'goalValue' })
export class GoalValuePipe implements PipeTransform {
  transform(value: number, goal: GoalLike, precise = false): string {
    return goalValueText(goal, value, precise);
  }
}

export const STATUS_LABELS: Record<PaceStatus, string> = {
  UPCOMING: 'Not started',
  AHEAD: 'Ahead',
  ON_TRACK: 'On track',
  BEHIND: 'Behind',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
};

export const STATUS_TONES: Record<PaceStatus, 'success' | 'warning' | 'danger' | 'info' | null> = {
  UPCOMING: null,
  AHEAD: 'success',
  ON_TRACK: 'info',
  BEHIND: 'warning',
  COMPLETED: 'success',
  MISSED: 'danger',
};

/** One sentence saying where the user stands, e.g. "6 h behind the plan." (US-03). */
export function paceSentence(goal: GoalLike, progress: GoalProgress): string {
  const diff = progress.value - progress.expected;
  switch (progress.status) {
    case 'COMPLETED':
      return 'Target reached.';
    case 'MISSED':
      return `Ended ${goalValueText(goal, progress.target - progress.value)} short of the target.`;
    case 'UPCOMING':
      return 'Starts later.';
    case 'AHEAD':
      return `${goalValueText(goal, diff)} ahead of the plan.`;
    case 'BEHIND':
      return `${goalValueText(goal, -diff)} behind the plan.`;
    case 'ON_TRACK':
      return 'Right on plan.';
  }
}

export function scheduleText(
  goal: Pick<Goal, 'mode' | 'period' | 'startDate' | 'deadline'>,
): string {
  if (goal.mode === 'RECURRING') {
    return goal.period === 'WEEKLY' ? 'Every week' : 'Every month';
  }
  return `${longDate(goal.startDate)} – ${longDate(goal.deadline!)}`;
}

/** A stable colour per goal; always shown next to the goal's name. */
export function goalColor(goalId: number | null): string {
  return goalId === null ? 'var(--color-text-tertiary)' : `var(--goal-${(goalId % 8) + 1})`;
}

/** 0..1 for progress bars. */
export function progressRatio(progress: Pick<GoalProgress, 'value' | 'target'>): number {
  return progress.target > 0 ? Math.min(1, progress.value / progress.target) : 0;
}
