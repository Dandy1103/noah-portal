import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { SessionService } from '../auth/session.service';

interface Employee {
  employeeNumber: string;
  displayName: string;
  department: string;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'noah-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  readonly user = inject(SessionService).user;

  readonly employee = toSignal(inject(HttpClient).get<Employee>('/api/me/employee').pipe(
    catchError(() => of(null))
  ), { initialValue: null });
}
