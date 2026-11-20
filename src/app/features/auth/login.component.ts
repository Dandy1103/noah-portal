import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HeaderComponent } from '../../layout/header/header.component';

@Component({
    selector: 'noah-login',
    standalone: true,
    imports: [HeaderComponent],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent {
    private readonly route = inject(ActivatedRoute);

    get errorMessage(): string {
        const error = this.route.snapshot.queryParamMap.get('error');
        if (error === 'unavailable') return '目前無法登入，請稍後再試。';
        if (error === 'signin') return '登入未完成，請再試一次。';
        return '';
    }
}
