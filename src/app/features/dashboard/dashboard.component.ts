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
  jobTitle: string | null;
  hiredOn: string | null;
  bornOn: string | null;
  employmentType: string | null;
  managerName: string | null;
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

  employmentLabel(value: string | null): string {
    const labels: Record<string, string> = {
      regular: '正職',
      part_time: '部分工時',
      fixed_term: '定期契約',
      intern: '實習',
    };
    return value ? labels[value] ?? value : '—';
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${year}/${month}/${day}` : value;
  }

  tenureLabel(value: string | null): string {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return '';
    const today = new Date();
    let years = today.getFullYear() - year;
    let months = today.getMonth() + 1 - month;
    if (today.getDate() < day) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years < 0) return '';
    if (years === 0 && months === 0) return '未滿 1 個月';
    if (years === 0) return `${months} 個月`;
    if (months === 0) return `${years} 年`;
    return `${years} 年 ${months} 個月`;
  }
}
