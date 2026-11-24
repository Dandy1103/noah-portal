import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';

interface PortalUser {
    displayName: string;
    hrmUrl: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
    private readonly http = inject(HttpClient);
    private readonly signedInUser = signal<PortalUser | null>(null);
    readonly user = this.signedInUser.asReadonly();

    check() {
        return this.http.get<PortalUser>('/api/session').pipe(
            tap((user) => this.signedInUser.set(user))
        );
    }
}

export const requireSession: CanActivateFn = () => {
    const session = inject(SessionService);
    const router = inject(Router);
    return session.check().pipe(
        map(() => true),
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                location.replace('/auth/login?' + new URLSearchParams({ next: location.pathname + location.search }));
                return of(false);
            }
            return of(router.createUrlTree(['/login'], { queryParams: { error: 'unavailable', next: location.pathname + location.search } }));
        })
    );
};
