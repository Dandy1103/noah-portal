import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { requireSession } from './features/auth/session.service';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [requireSession],
        children: [
            { path: '', component: DashboardComponent },
        ]
    }
];
