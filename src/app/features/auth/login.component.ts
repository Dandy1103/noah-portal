import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'noah-login',
    standalone: true,
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);

    get signedOut(): boolean {
        return this.route.snapshot.queryParamMap.get('signedOut') === '1';
    }

    get loginUrl(): string {
        const next = this.route.snapshot.queryParamMap.get('next') ?? '/';
        return '/auth/login?' + new URLSearchParams({ next });
    }

    ngOnInit() {
        if (!this.errorMessage && !this.signedOut) location.replace(this.loginUrl);
    }

    get errorMessage(): string {
        const error = this.route.snapshot.queryParamMap.get('error');
        if (error === 'unavailable') return '目前無法登入，請稍後再試。';
        if (error === 'signin') return '登入未完成，請再試一次。';
        return '';
    }
}
