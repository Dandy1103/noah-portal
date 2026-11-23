import { HttpClient } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NoahHeaderAction, NoahHeaderComponent } from '@dandy1103/ui';
import { catchError, of } from 'rxjs';
import { SessionService } from '../../features/auth/session.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NoahHeaderComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  readonly homeHref = new URL('/', location.origin).href;
  readonly actions: NoahHeaderAction[] = [
    { label: '個人資料', href: new URL('profile', this.homeHref).href },
    { label: '我的權限', href: new URL('permissions', this.homeHref).href },
    { label: '變更密碼', href: new URL('auth/change-password', this.homeHref).href },
    { label: '登出', href: new URL('auth/logout', this.homeHref).href, method: 'post' },
  ];
  private readonly http = inject(HttpClient);
  private readonly user = inject(SessionService).user;
  private readonly employeeName = toSignal(
    this.http.get<{ displayName: string }>('/api/me/employee').pipe(
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );

  readonly userName = computed(() => this.employeeName()?.displayName || this.user()?.displayName || '');
}
