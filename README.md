# Focentra Frontend

Angular 22 client for [Focentra-Backend](https://github.com/aleksa0206/Focentra-Backend): track your study time against goals and see whether you are on pace.

Live: [focentra.space](https://focentra.space)

![Dashboard](docs/screenshots/dashboard.png)

| Goal with progress against an even pace | A year of activity |
| --- | --- |
| ![Goal detail](docs/screenshots/goal.png) | ![Statistics](docs/screenshots/statistics.png) |
| **Shared goal: contributions, members, invite link** | **Phone** |
| ![Shared goal](docs/screenshots/shared-goal.png) | <img src="docs/screenshots/mobile.png" alt="Dashboard on a phone" width="260"> |

## Running

```bash
npm install
npm start          # http://localhost:4200, API at http://localhost:4000
npm test           # Vitest (unit)
npm run build      # production build into dist/
```

Set `FRONTEND_URL=http://localhost:4200` in the backend `.env`. The API URL lives in `src/environments/`. With the backend's demo data (`npm run seed:demo` there), sign in as `demo@focentra.local` / `Password123`.

## Screens

- **Dashboard**: today, this week, your streak, active goals with pace, hours per week.
- **Goals**: create, edit and archive goals. The detail page has the progress chart against an even pace, past weeks or months (recurring goals), the entries of every member, invite links and members.
- **Time log**: everything you tracked, filtered by period and goal. You can add or fix past time; a session past midnight works.
- **Statistics**: a year-long activity heatmap, hours per week, time per goal.
- **Account**: name and time zone, 2FA, data export, account deletion.

The timer sits in the top bar on every page. One click starts it, the arrow starts it on a goal, and it warns after 8 hours.

## Structure

```
src/app/
  core/       api/ (models, one service per resource, error normalization), auth/ (session,
              interceptor, guards), timer.service (the one running timer)
  shared/     charts/ (heatmap, week bars, progress chart: hand-written SVG), ui/ (form field,
              goal card, dialogs, toast…), util/ (time zones, durations, goal formatting)
  layout/     shell (sidebar + top bar with the timer), auth layout, 404
  features/   auth, dashboard, goals, entries, stats, invites, account
src/styles/   _tokens.scss (single source of design values → CSS variables), _mixins, _reset, _base
```

## Decisions that aren't obvious from the code

- **Access token in memory only.** After a reload the session is restored via the httpOnly refresh cookie (`provideAppInitializer` → `POST /auth/refresh` → `GET /auth/me`). On a 401 the interceptor does one shared refresh for all parallel requests, because the backend rotates the refresh token.
- **Everything is shown in the profile time zone, not the browser's**, so the days on screen match the days the backend counts statistics in. Manual entries are typed as wall-clock times in that zone and converted with `@date-fns/tz`; an end time before the start means the session ended the next day.
- **No chart library.** The three charts are small SVG components that draw at the measured width of their panel, so text keeps its size on any screen. Each has a hover tooltip and a "Show as table" view with the same numbers for keyboard and screen-reader users. The heatmap uses one hue from light to dark, and the goal colours are a CVD-checked palette always shown next to the goal's name.
- **The timer syncs instead of pushing.** It is reloaded every minute while the tab is visible and whenever the tab comes back, so a start or stop on another device shows up without WebSockets. Totals on the dashboard keep counting while the timer runs.
- **No NgRx and no UI library.** Pages follow load → show → change → reload with `rxResource`. List state (period, goal, page) lives in the URL. Only Angular CDK is used (dialog, menu, clipboard).
- **PWA.** The app installs from the browser and caches its shell, but data needs the network (offline tracking is out of scope).

## Docker

The image builds the same-origin variant (`apiUrl: /api`) and serves it with nginx, which proxies `/api` to the backend service `api` and sets a strict Content-Security-Policy. It is started by the backend's `docker-compose.prod.yaml`.

`npm run icons` regenerates the PNG app icons from the logo geometry.
