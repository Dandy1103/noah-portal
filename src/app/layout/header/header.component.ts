import { Component, inject } from '@angular/core';
import { SessionService } from '../../features/auth/session.service';

@Component({
  selector: 'noah-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  readonly user = inject(SessionService).user;
}
