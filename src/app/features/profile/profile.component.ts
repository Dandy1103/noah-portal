import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

interface EmployeeProfile {
  employeeNumber: string;
  displayName: string;
  department: string | null;
  status: string;
  jobTitle: string | null;
  hiredOn: string | null;
  bornOn: string | null;
  employmentType: string | null;
  managerName: string | null;
}

interface ProfileRow {
  label: string;
  value: string;
}

type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: EmployeeProfile }
  | { status: 'missing' }
  | { status: 'failed' };

const EMPLOYMENT_LABELS: Record<string, string> = {
  regular: '正職',
  part_time: '部分工時',
  fixed_term: '定期契約',
  intern: '實習',
};

const STATUS_LABELS: Record<string, string> = {
  active: '在職',
  inactive: '已停用',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private readonly http = inject(HttpClient);

  readonly state = toSignal(
    this.http.get<EmployeeProfile>('/api/me/employee').pipe(
      map((profile): ProfileState => ({ status: 'ready', profile })),
      catchError((error: HttpErrorResponse) => of<ProfileState>(
        error.status === 404 ? { status: 'missing' } : { status: 'failed' },
      )),
    ),
    { initialValue: { status: 'loading' } },
  );

  rows(profile: EmployeeProfile): ProfileRow[] {
    return [
      { label: '姓名', value: profile.displayName },
      { label: '員工編號', value: profile.employeeNumber },
      { label: '部門', value: profile.department ?? '' },
      { label: '職稱', value: profile.jobTitle ?? '' },
      { label: '任用別', value: this.employmentLabel(profile.employmentType) },
      { label: '到職日', value: profile.hiredOn ?? '' },
      { label: '生日', value: profile.bornOn ?? '' },
      { label: '主管', value: profile.managerName ?? '' },
      { label: '狀態', value: STATUS_LABELS[profile.status] ?? profile.status },
    ].map((row) => ({ label: row.label, value: row.value.trim() || '—' }));
  }

  private employmentLabel(value: string | null): string {
    if (!value) return '';
    return EMPLOYMENT_LABELS[value] ?? value;
  }
}
