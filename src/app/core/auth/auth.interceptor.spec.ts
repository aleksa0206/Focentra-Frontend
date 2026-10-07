import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiUrl } from '../api/http';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  function loginAs(token: string): void {
    auth.login('a@b.rs', 'x').subscribe();
    backend
      .expectOne(apiUrl('/auth/login'))
      .flush({ token, user: { id: 1, name: 'A', email: 'a@b.rs', timezone: 'UTC' } });
  }

  it('adds the Bearer token to API requests', () => {
    loginAs('access-1');

    http.get(apiUrl('/goals')).subscribe();

    expect(backend.expectOne(apiUrl('/goals')).request.headers.get('Authorization')).toBe(
      'Bearer access-1',
    );
  });

  it('does not send the token to non-API requests', () => {
    loginAs('access-1');
    http.get('https://example.com/data').subscribe();
    expect(backend.expectOne('https://example.com/data').request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('on 401 does a single shared refresh for parallel requests and retries them with the new token', () => {
    loginAs('old');

    const results: unknown[] = [];
    http.get(apiUrl('/goals')).subscribe((r) => results.push(r));
    http.get(apiUrl('/timer')).subscribe((r) => results.push(r));

    backend.expectOne(apiUrl('/goals')).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(apiUrl('/timer')).flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.match(apiUrl('/auth/refresh'));
    expect(refresh.length).toBe(1);
    expect(refresh[0].request.withCredentials).toBe(true);
    refresh[0].flush({ token: 'new' });

    const retriedUsers = backend.expectOne(apiUrl('/goals'));
    const retriedHolidays = backend.expectOne(apiUrl('/timer'));
    expect(retriedUsers.request.headers.get('Authorization')).toBe('Bearer new');
    retriedUsers.flush(['u']);
    retriedHolidays.flush(['h']);

    expect(results).toEqual([['u'], ['h']]);
  });

  it('does not try to refresh when login returns 401 (wrong password or 2FA)', () => {
    let failed = false;
    http.post(apiUrl('/auth/login'), {}).subscribe({ error: () => (failed = true) });
    backend
      .expectOne(apiUrl('/auth/login'))
      .flush({ error: 'x' }, { status: 401, statusText: 'Unauthorized' });

    backend.expectNone(apiUrl('/auth/refresh'));
    expect(failed).toBe(true);
  });

  it('ends the session and passes the error on when refresh fails', () => {
    loginAs('old');
    const expire = vi.spyOn(auth, 'expireSession');
    let failed = false;

    http.get(apiUrl('/goals')).subscribe({ error: () => (failed = true) });
    backend.expectOne(apiUrl('/goals')).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne(apiUrl('/auth/refresh'))
      .flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(expire).toHaveBeenCalledOnce();
    expect(failed).toBe(true);
  });

  it('leaves non-401 errors alone', () => {
    loginAs('t');
    let status = 0;
    http.get(apiUrl('/goals')).subscribe({ error: (e: { status: number }) => (status = e.status) });
    backend.expectOne(apiUrl('/goals')).flush(null, { status: 403, statusText: 'Forbidden' });

    backend.expectNone(apiUrl('/auth/refresh'));
    expect(status).toBe(403);
  });
});
