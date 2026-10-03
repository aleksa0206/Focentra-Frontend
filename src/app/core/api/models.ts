// Shapes of the backend responses (Focentra-Backend). Instants are ISO strings in UTC; calendar
// dates are `YYYY-MM-DD` in the zone of the goal or the user.

export type IsoDateTime = string;
/** `YYYY-MM-DD` */
export type DateKey = string;

export interface User {
  id: number;
  email: string;
  name: string;
  timezone: string;
  twoFactorEnabled: boolean;
  createdAt: IsoDateTime;
}

export type GoalType = 'TIME' | 'COUNT';
export type GoalMode = 'DEADLINE' | 'RECURRING';
export type GoalPeriod = 'WEEKLY' | 'MONTHLY';
export type MemberRole = 'OWNER' | 'MEMBER';
export type PaceStatus = 'UPCOMING' | 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'COMPLETED' | 'MISSED';

export interface GoalProgress {
  windowStart: IsoDateTime;
  windowEnd: IsoDateTime;
  /** Seconds for TIME goals, units for COUNT goals; same for target and expected. */
  value: number;
  target: number;
  expected: number;
  status: PaceStatus;
}

export interface Goal {
  id: number;
  name: string;
  type: GoalType;
  unit: string | null;
  mode: GoalMode;
  period: GoalPeriod | null;
  startDate: DateKey;
  deadline: DateKey | null;
  timezone: string;
  archived: boolean;
  role: MemberRole;
  memberCount: number;
  target: number;
  progress: GoalProgress;
}

export interface Contribution {
  userId: number;
  name: string | null;
  value: number;
}

export interface GoalDetail extends Goal {
  contributions: Contribution[];
}

export interface GoalChart {
  windowStart: IsoDateTime;
  windowEnd: IsoDateTime;
  target: number;
  points: { date: DateKey; value: number }[];
}

export interface GoalPeriodSummary {
  start: IsoDateTime;
  end: IsoDateTime;
  target: number;
  value: number;
  achieved: boolean;
  current: boolean;
}

export interface Member {
  userId: number;
  name: string;
  role: MemberRole;
  joinedAt: IsoDateTime;
}

export interface Invite {
  id: number;
  expiresAt: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface CreatedInvite {
  id: number;
  token: string;
  expiresAt: IsoDateTime;
}

export interface InvitePreview {
  goal: { id: number; name: string; type: GoalType; unit: string | null; mode: GoalMode };
  ownerName: string;
  memberCount: number;
  alreadyMember: boolean;
}

export interface TimeEntry {
  id: number;
  goalId: number | null;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  note: string | null;
  running: boolean;
  durationSeconds: number;
}

export interface OwnTimeEntry extends TimeEntry {
  goal: { id: number; name: string } | null;
}

export interface SharedTimeEntry extends TimeEntry {
  user: { id: number; name: string };
}

export interface ProgressEntry {
  id: number;
  goalId: number;
  amount: number;
  occurredOn: DateKey;
  note: string | null;
}

export interface SharedProgressEntry extends ProgressEntry {
  user: { id: number; name: string };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Heatmap {
  from: DateKey;
  to: DateKey;
  timezone: string;
  days: { date: DateKey; seconds: number }[];
}

export interface Trend {
  timezone: string;
  weeks: { weekStart: DateKey; seconds: number }[];
}

export interface Breakdown {
  from: DateKey;
  to: DateKey;
  items: { goalId: number | null; name: string | null; seconds: number }[];
}
