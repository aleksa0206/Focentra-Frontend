import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <main class="auth">
      <div class="auth__column">
        <p class="auth__brand">
          <img class="auth__mark" src="logo-mark.svg" alt="" width="34" height="34" />
          Focentra
        </p>
        <div class="auth__panel">
          <router-outlet />
        </div>
        <p class="auth__footnote">Time tracking for the goals you work toward</p>
      </div>
    </main>
  `,
  styles: `
    .auth {
      display: grid;
      place-items: start center;
      min-height: 100%;
      padding: 10vh var(--space-4) var(--space-8);
      background:
        radial-gradient(1200px 500px at 50% -10%, var(--color-accent-subtle), transparent 70%),
        var(--color-bg);
    }
    .auth__column {
      display: grid;
      gap: var(--space-5);
      width: 100%;
      max-width: 400px;
    }
    .auth__brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      font-size: 18px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: -0.01em;
    }
    .auth__mark {
      width: 34px;
      height: 34px;
    }
    .auth__panel {
      padding: var(--space-8);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow:
        0 1px 2px rgba(15, 20, 32, 0.04),
        0 8px 24px rgba(15, 20, 32, 0.06);
    }
    .auth__footnote {
      color: var(--color-text-tertiary);
      font-size: var(--font-size-meta);
      text-align: center;
    }
  `,
})
export class AuthLayout {}
