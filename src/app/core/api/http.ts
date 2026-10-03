import { HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const API_URL = environment.apiUrl;

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function isApiRequest(url: string): boolean {
  return url.startsWith(API_URL);
}

type QueryValue = string | number | boolean | undefined | null;

/** Skips empty values so an "All" filter does not end up as `?status=` in the URL. */
export function toParams(query: Record<string, QueryValue>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
