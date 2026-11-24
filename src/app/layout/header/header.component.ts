import { HttpClient } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NoahHeaderAction, NoahHeaderComponent } from '@dandy1103/ui';
import { catchError, of } from 'rxjs';
import { SessionService } from '../../features/auth/session.service';
import { loadCatalog, loadedCatalog, NavCatalog, portalEntry } from '../navbar/nav-catalog';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NoahHeaderComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private readonly catalog = signal<NavCatalog | null>(loadedCatalog() ?? null);
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
    const next = location.pathname + location.search;
    const query = new URLSearchParams({ next }).toString();
    return [
      { label: '個人資料', href: portalEntry(this.catalog(), 'profile') },
      { label: '我的權限', href: portalEntry(this.catalog(), 'permissions') },
      { label: '變更密碼', href: `/auth/change-password?${query}` },
      { label: '登出', href: `/auth/logout?${query}`, method: 'post' },
    ];
  }
}
