import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { LoginComponent } from './features/auth/login.component';
import { requireSession } from './features/auth/session.service';
import { PermissionsComponent } from './features/permissions/permissions.component';
import { ProfileComponent } from './features/profile/profile.component';

export const remoteRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [requireSession],
    children: [
      { path: '', component: DashboardComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'permissions', component: PermissionsComponent },
    ],
  },
];
