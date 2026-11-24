import { HttpClient } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NoahHeaderAction, NoahHeaderComponent } from '@dandy1103/ui';
import { catchError, of } from 'rxjs';
import { SessionService } from '../../features/auth/session.service';
import { loadCatalog, NavCatalog, portalEntry } from '../navbar/nav-catalog';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NoahHeaderComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private readonly catalog = signal<NavCatalog | null>(null);
  private readonly http = inject(HttpClient);
  private readonly user = inject(SessionService).user;
  private readonly employeeName = toSignal(
    this.http.get<{ displayName: string }>('/api/me/employee').pipe(
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );

  readonly userName = computed(() => this.employeeName()?.displayName || this.user()?.displayName || '');

  constructor() {
    const request = new AbortController();
    inject(DestroyRef).onDestroy(() => request.abort());
    void loadCatalog(request.signal).then((value) => this.catalog.set(value));
  }

  get homeHref(): string {
    return portalEntry(this.catalog());
  }

  get actions(): NoahHeaderAction[] {
    const home = this.homeHref;
    const origin = home ? new URL(home, location.origin).origin + '/' : '';
    return [
      { label: '個人資料', href: portalEntry(this.catalog(), 'profile') },
      { label: '我的權限', href: portalEntry(this.catalog(), 'permissions') },
      { label: '變更密碼', href: origin ? new URL('auth/change-password', origin).href : '' },
      { label: '登出', href: origin ? new URL('auth/logout', origin).href : '', method: 'post' },
    ];
  }
}
