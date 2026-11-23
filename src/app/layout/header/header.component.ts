import { HttpClient } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NoahHeaderComponent } from '@dandy1103/ui';
import { catchError, of } from 'rxjs';
import { SessionService } from '../../features/auth/session.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NoahHeaderComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
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
