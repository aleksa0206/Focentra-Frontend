import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl, toParams } from './http';
import {
  Breakdown,
  CreatedInvite,
  DateKey,
  Goal,
  GoalChart,
  GoalDetail,
  GoalMode,
  GoalPeriod,
  GoalPeriodSummary,
  GoalType,
  Heatmap,
  Invite,
  InvitePreview,
  Member,
  OwnTimeEntry,
  Paged,
  ProgressEntry,
  SharedProgressEntry,
  SharedTimeEntry,
  TimeEntry,
  Trend,
  User,
} from './models';

// One service per backend resource. Components never build URLs themselves.

export type PageParams = { page?: number | undefined; limit?: number | undefined };

export interface GoalInput {
  name: string;
  type: GoalType;
  unit?: string | undefined;
  mode: GoalMode;
  period?: GoalPeriod | undefined;
  target: number;
  startDate?: DateKey | undefined;
  deadline?: DateKey | undefined;
}

export type GoalChanges = Partial<{
  name: string;
  unit: string;
  target: number;
  startDate: DateKey;
  deadline: DateKey;
  archived: boolean;
}>;

@Injectable({ providedIn: 'root' })
export class GoalsApi {
  private readonly http = inject(HttpClient);

  list(state: 'active' | 'archived' = 'active'): Observable<Goal[]> {
    return this.http.get<Goal[]>(apiUrl('/goals'), { params: toParams({ state }) });
  }

  get(id: number): Observable<GoalDetail> {
    return this.http.get<GoalDetail>(apiUrl(`/goals/${id}`));
  }

  create(input: GoalInput): Observable<GoalDetail> {
    return this.http.post<GoalDetail>(apiUrl('/goals'), input);
  }

  update(id: number, changes: GoalChanges): Observable<GoalDetail> {
    return this.http.patch<GoalDetail>(apiUrl(`/goals/${id}`), changes);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(apiUrl(`/goals/${id}`));
  }

  chart(id: number): Observable<GoalChart> {
    return this.http.get<GoalChart>(apiUrl(`/goals/${id}/chart`));
  }

  periods(id: number): Observable<GoalPeriodSummary[]> {
    return this.http.get<GoalPeriodSummary[]>(apiUrl(`/goals/${id}/periods`));
  }

  timeEntries(id: number, params: PageParams): Observable<Paged<SharedTimeEntry>> {
    return this.http.get<Paged<SharedTimeEntry>>(apiUrl(`/goals/${id}/time-entries`), {
      params: toParams(params),
    });
  }

  progressEntries(id: number, params: PageParams): Observable<Paged<SharedProgressEntry>> {
    return this.http.get<Paged<SharedProgressEntry>>(apiUrl(`/goals/${id}/progress-entries`), {
      params: toParams(params),
    });
  }

  addProgress(
    id: number,
    input: { amount: number; occurredOn?: DateKey; note: string | null },
  ): Observable<ProgressEntry> {
    return this.http.post<ProgressEntry>(apiUrl(`/goals/${id}/progress-entries`), input);
  }
}

@Injectable({ providedIn: 'root' })
export class MembersApi {
  private readonly http = inject(HttpClient);

  list(goalId: number): Observable<Member[]> {
    return this.http.get<Member[]>(apiUrl(`/goals/${goalId}/members`));
  }

  /** The owner removes someone, or a member removes themselves (leaves). */
  remove(goalId: number, userId: number): Observable<void> {
    return this.http.delete<void>(apiUrl(`/goals/${goalId}/members/${userId}`));
  }

  invites(goalId: number): Observable<Invite[]> {
    return this.http.get<Invite[]>(apiUrl(`/goals/${goalId}/invites`));
  }

  createInvite(goalId: number): Observable<CreatedInvite> {
    return this.http.post<CreatedInvite>(apiUrl(`/goals/${goalId}/invites`), null);
  }

  revokeInvite(goalId: number, inviteId: number): Observable<void> {
    return this.http.delete<void>(apiUrl(`/goals/${goalId}/invites/${inviteId}`));
  }

  preview(token: string): Observable<InvitePreview> {
    return this.http.get<InvitePreview>(apiUrl(`/invites/${encodeURIComponent(token)}`));
  }

  accept(token: string): Observable<{ goalId: number }> {
    return this.http.post<{ goalId: number }>(
      apiUrl(`/invites/${encodeURIComponent(token)}/accept`),
      null,
    );
  }
}

export interface TimeEntryInput {
  startedAt: string;
  endedAt: string;
  goalId: number | null;
  note: string | null;
}

@Injectable({ providedIn: 'root' })
export class TimeEntriesApi {
  private readonly http = inject(HttpClient);

  running(): Observable<{ entry: TimeEntry | null }> {
    return this.http.get<{ entry: TimeEntry | null }>(apiUrl('/timer'));
  }

  start(input: { goalId: number | null; note: string | null }): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(apiUrl('/timer/start'), input);
  }

  stop(): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(apiUrl('/timer/stop'), null);
  }

  list(
    query: PageParams & { from?: DateKey; to?: DateKey; goalId?: number | undefined },
  ): Observable<Paged<OwnTimeEntry>> {
    return this.http.get<Paged<OwnTimeEntry>>(apiUrl('/time-entries'), {
      params: toParams(query),
    });
  }

  create(input: TimeEntryInput): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(apiUrl('/time-entries'), input);
  }

  update(id: number, changes: Partial<TimeEntryInput>): Observable<TimeEntry> {
    return this.http.patch<TimeEntry>(apiUrl(`/time-entries/${id}`), changes);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(apiUrl(`/time-entries/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class ProgressEntriesApi {
  private readonly http = inject(HttpClient);

  update(
    id: number,
    changes: Partial<{ amount: number; occurredOn: DateKey; note: string | null }>,
  ): Observable<ProgressEntry> {
    return this.http.patch<ProgressEntry>(apiUrl(`/progress-entries/${id}`), changes);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(apiUrl(`/progress-entries/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class StatsApi {
  private readonly http = inject(HttpClient);

  heatmap(range: { from?: DateKey; to?: DateKey } = {}): Observable<Heatmap> {
    return this.http.get<Heatmap>(apiUrl('/stats/heatmap'), { params: toParams(range) });
  }

  trend(weeks = 12): Observable<Trend> {
    return this.http.get<Trend>(apiUrl('/stats/trend'), { params: toParams({ weeks }) });
  }

  breakdown(range: { from: DateKey; to: DateKey }): Observable<Breakdown> {
    return this.http.get<Breakdown>(apiUrl('/stats/breakdown'), { params: toParams(range) });
  }
}

@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);

  update(changes: Partial<{ name: string; timezone: string }>): Observable<User> {
    return this.http.patch<User>(apiUrl('/me'), changes);
  }

  remove(password: string): Observable<void> {
    return this.http.delete<void>(apiUrl('/me'), { body: { password }, withCredentials: true });
  }

  export(): Observable<Blob> {
    return this.http.get(apiUrl('/me/export'), { responseType: 'blob' });
  }
}
