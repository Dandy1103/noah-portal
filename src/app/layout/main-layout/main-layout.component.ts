
import { NoahLoadingMaskComponent } from '@dandy1103/ui';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HeaderComponent } from '../header/header.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { loadCatalog } from '../navbar/nav-catalog';

@Component({
  selector: 'noah-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    NavbarComponent,
    NoahLoadingMaskComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  readonly shellReady = signal(false);

  constructor() {
    void loadCatalog().finally(() => this.shellReady.set(true));
  }
}
