import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { TimerService } from '../core/timer.service';
import { Icon, IconName } from '../shared/ui/icon';
import { TimerControl } from './timer-control';

const NAV: { label: string; path: string; icon: IconName; exact?: boolean }[] = [
  { label: 'Dashboard', path: '/', icon: 'home', exact: true },
  { label: 'Goals', path: '/goals', icon: 'target' },
  { label: 'Time log', path: '/entries', icon: 'list' },
  { label: 'Statistics', path: '/stats', icon: 'chart' },
];

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    Icon,
    TimerControl,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly auth = inject(AuthService);
  protected readonly nav = NAV;
  protected readonly navOpen = signal(false);

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('');
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    inject(TimerService).start(destroyRef);
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.navOpen.set(false));
  }
}
