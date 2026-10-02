import { CanActivateFn, Route, Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/guards';
import { AppShell } from './layout/app-shell';
import { AuthLayout } from './layout/auth-layout';
import { NotFoundPage } from './layout/system-pages';

// Each auth page gets its own path with the layout. Grouping them under `path: ''` would
// also match "/" (an empty layout with no page) before the router reaches the shell.
function authPage(
  path: string,
  title: string,
  loadComponent: Route['loadComponent'],
  guards: CanActivateFn[] = [],
): Route {
  return {
    path,
    component: AuthLayout,
    canActivate: guards,
    children: [{ path: '', title, loadComponent }],
  };
}

export const routes: Routes = [
  authPage('login', 'Sign in', () => import('./features/auth/login.page'), [guestGuard]),
  authPage('register', 'Create account', () => import('./features/auth/register.page'), [
    guestGuard,
  ]),
  authPage(
    'forgot-password',
    'Forgot password',
    () => import('./features/auth/forgot-password.page'),
    [guestGuard],
  ),
  // These two paths must stay as they are: the backend puts them in emails.
  authPage('reset-password', 'New password', () => import('./features/auth/reset-password.page')),
  authPage('verify-email', 'Confirm email', () => import('./features/auth/verify-email.page'), [
    guestGuard,
  ]),
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page'),
      },
      {
        path: 'goals',
        title: 'Goals',
        loadComponent: () => import('./features/goals/goals-list.page'),
      },
      {
        path: 'goals/new',
        title: 'New goal',
        loadComponent: () => import('./features/goals/goal-form.page'),
      },
      {
        path: 'goals/:id',
        title: 'Goal',
        loadComponent: () => import('./features/goals/goal-detail.page'),
      },
      {
        path: 'goals/:id/edit',
        title: 'Edit goal',
        loadComponent: () => import('./features/goals/goal-form.page'),
      },
      {
        path: 'entries',
        title: 'Time log',
        loadComponent: () => import('./features/entries/entries.page'),
      },
      {
        path: 'stats',
        title: 'Statistics',
        loadComponent: () => import('./features/stats/stats.page'),
      },
      {
        path: 'invites/:token',
        title: 'Join a goal',
        loadComponent: () => import('./features/invites/invite.page'),
      },
      {
        path: 'account',
        title: 'My account',
        loadComponent: () => import('./features/account/account.page'),
      },
      { path: '**', title: 'Not found', component: NotFoundPage },
    ],
  },
];
