import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { SessionService } from '../../features/auth/session.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private readonly http = inject(HttpClient);
  readonly user = inject(SessionService).user;
  readonly employeeName = toSignal(
    this.http.get<{ displayName: string }>('/api/me/employee').pipe(
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );
  readonly homeHref = '/';
  readonly passwordHref = '/auth/change-password';

  @ViewChild('account') account?: ElementRef<HTMLElement>;

  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.isMenuOpen) return;
    const target = event.target;
    const account = this.account?.nativeElement;
    if (target instanceof Node && account?.contains(target)) return;
    this.closeMenu();
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    this.closeMenu();
  }
}
