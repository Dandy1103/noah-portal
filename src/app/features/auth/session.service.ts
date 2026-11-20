import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';

interface PortalUser {
    displayName: string;
    hrmAvailable: boolean;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
    private readonly http = inject(HttpClient);
    private readonly signedInUser = signal<PortalUser | null>(null);
    readonly user = this.signedInUser.asReadonly();

    check() {
        return this.http.get<PortalUser>('/api/session').pipe(
            catchError(() => of(null)),
            tap((user) => this.signedInUser.set(user))
        );
    }
}

export const requireSession: CanActivateFn = () => {
    const session = inject(SessionService);
    const router = inject(Router);
    return session.check().pipe(map((user) => user ? true : router.createUrlTree(['/login'])));
};
