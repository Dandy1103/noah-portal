import { Component } from '@angular/core';
import { NoahNavbarComponent } from '@dandy1103/ui';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [NoahNavbarComponent],
  template: `<noah-navbar repo="noah-portal" fallbackLabel="入口" />`,
})
export class NavbarComponent {}
