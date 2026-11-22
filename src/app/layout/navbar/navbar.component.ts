import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../features/auth/session.service';
import { applyNav, loadCatalog, NavGroup } from './nav-catalog';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly user = inject(SessionService).user;
  private readonly remote = signal<Awaited<ReturnType<typeof loadCatalog>>>(null);
  readonly opened = signal<string | null>(null);
  readonly groups = computed(() => {
    const catalog = this.remote();
    if (!catalog) return this.localGroups();
    return applyNav(catalog, 'noah-portal', this.user()?.hrmUrl || '');
  });

  constructor() {
    const controller = new AbortController();
    inject(DestroyRef).onDestroy(() => controller.abort());
    void loadCatalog(controller.signal).then((catalog) => {
      if (catalog) this.remote.set(catalog);
    });
  }

  private readonly localGroups = computed((): NavGroup[] => {
    const hrmUrl = this.user()?.hrmUrl || '';
    const hrm = (section: string): string | null => {
      if (!hrmUrl) return null;
      const root = new URL(hrmUrl, location.origin);
      const folder = root.pathname.endsWith('/') ? root.pathname : `${root.pathname}/`;
      return new URL(section, `${root.origin}${folder}`).toString();
    };
    return [
      {
        label: '公告',
        sections: [
          { title: '公告', links: [
            { label: '公告列表', href: null },
            { label: '發布公告', href: null },
          ] },
        ],
      },
      {
        label: '通知',
        sections: [
          { title: '通知', links: [
            { label: '我的通知', href: null },
            { label: '發送通知', href: null },
          ] },
        ],
      },
      {
        label: '文件',
        sections: [
          { title: '文件', links: [
            { label: '文件庫', href: null },
            { label: '分類', href: null },
          ] },
        ],
      },
      {
        label: '行事曆',
        sections: [
          { title: '行事曆', links: [
            { label: '公司行事曆', href: null },
            { label: '活動', href: null },
          ] },
        ],
      },
      {
        label: '帳號管理',
        sections: [
          { title: '帳號', links: [
            { label: '帳號列表', href: null },
            { label: '帳號申請', href: null },
          ] },
          { title: '權限', links: [
            { label: '權限設定', href: null },
          ] },
        ],
      },
      {
        label: '應用管理',
        sections: [
          { title: '應用', links: [
            { label: '系統清單', href: null },
          ] },
        ],
      },
      {
        label: '人資管理',
        sections: [
          { title: '人員', links: [
            { label: '員工資料', href: hrm('employees') },
            { label: '組織', href: hrm('organization') },
          ] },
          { title: '出勤', links: [
            { label: '出勤紀錄', href: hrm('attendance') },
            { label: '加班', href: hrm('overtime') },
          ] },
          { title: '假勤', links: [
            { label: '請假', href: hrm('leave') },
            { label: '出差', href: hrm('trip') },
          ] },
        ],
      },
      {
        label: '客戶關係',
        sections: [
          { title: '客戶', links: [
            { label: '客戶資料', href: null },
            { label: '聯絡人', href: null },
          ] },
          { title: '銷售', links: [
            { label: '商機', href: null },
            { label: '報價', href: null },
            { label: '合約', href: null },
          ] },
        ],
      },
      {
        label: '財務會計',
        sections: [
          { title: '請款', links: [
            { label: '費用報銷', href: null },
            { label: '付款', href: null },
          ] },
          { title: '採購', links: [
            { label: '採購單', href: null },
            { label: '供應商', href: null },
          ] },
          { title: '庫存', links: [
            { label: '庫存查詢', href: null },
          ] },
        ],
      },
      {
        label: '資訊服務',
        sections: [
          { title: '服務', links: [
            { label: '報修', href: null },
            { label: '需求單', href: null },
          ] },
        ],
      },
      {
        label: '教育訓練',
        sections: [
          { title: '課程', links: [
            { label: '課程目錄', href: null },
            { label: '我的課程', href: null },
          ] },
          { title: '報名', links: [
            { label: '開課報名', href: null },
            { label: '學習紀錄', href: null },
          ] },
        ],
      },
      {
        label: '簽核',
        sections: [
          { title: '流程', links: [
            { label: '待我簽核', href: null },
            { label: '我送出的', href: null },
            { label: '表單', href: null },
          ] },
        ],
      },
      {
        label: '總務行政',
        sections: [
          { title: '場地', links: [
            { label: '會議室', href: null },
            { label: '訪客', href: null },
          ] },
          { title: '庶務', links: [
            { label: '備品', href: null },
            { label: '公務車', href: null },
            { label: '修繕', href: null },
          ] },
        ],
      },
      {
        label: '薪資',
        sections: [
          { title: '薪資', links: [
            { label: '薪資單', href: null },
            { label: '投保', href: null },
          ] },
          { title: '稅務', links: [
            { label: '所得扣繳', href: null },
          ] },
        ],
      },
      {
        label: '專案管理',
        sections: [
          { title: '案子', links: [
            { label: '專案', href: null },
            { label: '成員', href: null },
            { label: '進度', href: null },
          ] },
          { title: '工時', links: [
            { label: '工時填報', href: null },
          ] },
        ],
      },
    ];
  });

  open(label: string): void {
    this.opened.set(label);
  }

  close(event: FocusEvent): void {
    const next = event.relatedTarget;
    const current = event.currentTarget;
    if (next instanceof Node && current instanceof Node && current.contains(next)) return;
    this.opened.set(null);
  }

  hide(): void {
    this.opened.set(null);
  }
}
