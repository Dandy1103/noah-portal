import { HttpClient } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { appHref, loadCatalog, type CatalogSystem } from '../../core/app-catalog';

interface EmployeeProfile {
  employeeNumber: string;
  displayName: string;
  department: string;
  jobTitle: string | null;
}

type InfoPanel = 'notices' | 'leave' | 'notifications' | 'documents';

interface InfoFeed {
  id: InfoPanel;
  title: string;
  summary: string;
  count: number;
}

type ServiceIcon = 'hrm' | 'crm' | 'erp' | 'itsm' | 'lms' | 'approval' | 'affairs' | 'payroll' | 'project' | 'app';

interface ServiceTile {
  label: string;
  icon: ServiceIcon;
  href: string | null;
}

const SERVICE_ICONS: Record<string, ServiceIcon> = {
  'noah-hrm': 'hrm',
  'noah-crm': 'crm',
  'noah-erp': 'erp',
  'noah-itsm': 'itsm',
  'noah-lms': 'lms',
  'noah-approval': 'approval',
  'noah-affairs': 'affairs',
  'noah-payroll': 'payroll',
  'noah-project': 'project',
};

interface Notice {
  stamp: string;
  date: string;
  title: string;
  unit: string;
  author: string;
}

interface LeaveRequest {
  name: string;
  kind: string;
  when: string;
}

interface InboxNote {
  stamp: string;
  date: string;
  text: string;
}

interface PortalDocument {
  stamp: string;
  date: string;
  title: string;
  kind: string;
}

interface BoardColumn {
  label: string;
  width: string;
}

interface BoardCell {
  text: string;
  stamp: string;
  warning: boolean;
}

interface BoardRow {
  key: string;
  cells: BoardCell[];
}

interface PunchCard {
  arrivedAt: string | null;
  leftAt: string | null;
}

const PAGE_SIZE = 6;
const CHECK_IN_KEY = 'noah-portal-check-in';

@Component({
  selector: 'noah-dashboard',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly user = inject(SessionService).user;
  private readonly catalogSystems = signal<CatalogSystem[] | null>(null);

  readonly employee = toSignal(
    inject(HttpClient).get<EmployeeProfile>('/api/me/employee').pipe(
      catchError(() => of(null))
    ),
    { initialValue: null }
  );

  readonly clock = signal(new Date());
  readonly todayStamp = this.localStamp(new Date());
  readonly todayLabel = this.formatToday();
  readonly monthCursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly selectedStamp = signal<string | null>(null);
  readonly weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  readonly punch = signal<PunchCard>(this.readTodayPunch());

  readonly panel = signal<InfoPanel>('notices');
  readonly query = signal('');
  readonly page = signal(1);

  readonly notices: Notice[] = [
    { stamp: '2026-11-20', date: '11月20日', title: 'ERP 將於週六晚間例行維護', unit: '資訊部', author: '林志明' },
    { stamp: '2026-11-18', date: '11月18日', title: '年度健康檢查開放預約', unit: '人資部', author: '陳雅琪' },
    { stamp: '2026-11-16', date: '11月16日', title: '十二月全員大會議程', unit: '總經理室', author: '周文安' },
    { stamp: '2026-11-14', date: '11月14日', title: '辦公室冷氣保養，11月28日上午停機', unit: '總務部', author: '王大為' },
    { stamp: '2026-11-12', date: '11月12日', title: '差旅報銷請於月底前送出', unit: '財務部', author: '張惠美' },
    { stamp: '2026-11-10', date: '11月10日', title: '新進同仁教育訓練，11月26日', unit: '人資部', author: '陳雅琪' },
    { stamp: '2026-11-07', date: '11月7日', title: '停車場 B2 施工，請改停 B3', unit: '總務部', author: '王大為' },
    { stamp: '2026-11-05', date: '11月5日', title: '資訊安全演練通知', unit: '資訊部', author: '林志明' },
    { stamp: '2026-11-03', date: '11月3日', title: '尾牙地點票選開放', unit: '福委會', author: '吳佩玲' },
    { stamp: '2026-10-31', date: '10月31日', title: '11月薪資單已可下載', unit: '財務部', author: '張惠美' },
    { stamp: '2026-10-28', date: '10月28日', title: '訪客登記改為線上申請', unit: '總務部', author: '王大為' },
    { stamp: '2026-10-24', date: '10月24日', title: '會議室 A 更換投影設備', unit: '總務部', author: '王大為' },
    { stamp: '2026-10-21', date: '10月21日', title: '流感疫苗接種時段', unit: '人資部', author: '陳雅琪' },
    { stamp: '2026-10-16', date: '10月16日', title: '中秋禮券發放說明', unit: '福委會', author: '吳佩玲' },
  ];

  readonly leaveRequests: LeaveRequest[] = [
    { name: '王小明', kind: '特休', when: '11月24日至11月25日' },
    { name: '林雅婷', kind: '病假', when: '11月22日' },
    { name: '陳志豪', kind: '事假', when: '11月27日下午' },
    { name: '張惠美', kind: '特休', when: '12月1日至12月3日' },
    { name: '李建國', kind: '婚假', when: '12月8日至12月12日' },
    { name: '吳佩玲', kind: '特休', when: '11月26日' },
    { name: '黃子軒', kind: '病假', when: '11月21日' },
    { name: '蔡依玲', kind: '產檢假', when: '11月28日' },
    { name: '許家豪', kind: '公假', when: '11月25日' },
    { name: '鄭雅文', kind: '特休', when: '12月5日' },
  ];

  readonly notes: InboxNote[] = [
    { stamp: '2026-11-22', date: '11月22日', text: '王小明送出特休申請' },
    { stamp: '2026-11-21', date: '11月21日', text: '林雅婷更新了差勤文件' },
    { stamp: '2026-11-20', date: '11月20日', text: '人資公告了週六維護' },
    { stamp: '2026-11-19', date: '11月19日', text: '陳志豪送出事假申請' },
    { stamp: '2026-11-18', date: '11月18日', text: '張惠美預約了健康檢查' },
    { stamp: '2026-11-17', date: '11月17日', text: '李建國上傳了結婚登記證明' },
    { stamp: '2026-11-14', date: '11月14日', text: '總務通知冷氣保養時段' },
    { stamp: '2026-11-12', date: '11月12日', text: '吳佩玲的報銷已退回補件' },
    { stamp: '2026-11-10', date: '11月10日', text: '黃子軒完成資訊安全課程' },
    { stamp: '2026-11-07', date: '11月7日', text: '停車場施工通知已發布' },
    { stamp: '2026-11-05', date: '11月5日', text: '蔡依玲送出產檢假申請' },
    { stamp: '2026-11-03', date: '11月3日', text: '許家豪的公假已核准' },
  ];

  readonly companyEvents: { stamp: string; title: string }[] = [
    { stamp: '2026-11-16', title: '全員大會議程' },
    { stamp: '2026-11-18', title: '年度健康檢查' },
    { stamp: '2026-11-21', title: 'ERP 例行維護' },
  ];

  readonly documents: PortalDocument[] = [
    { stamp: '2026-11-01', date: '11月1日', title: '員工手冊', kind: '2026 年版' },
    { stamp: '2026-10-15', date: '10月15日', title: '差勤管理辦法', kind: '人事規章' },
    { stamp: '2026-09-02', date: '9月2日', title: '資訊服務申請單', kind: '表單' },
    { stamp: '2026-08-20', date: '8月20日', title: '差旅報銷辦法', kind: '財務規章' },
    { stamp: '2026-07-08', date: '7月8日', title: '訪客申請單', kind: '表單' },
    { stamp: '2026-06-12', date: '6月12日', title: '資訊安全規範', kind: '資安' },
    { stamp: '2026-04-01', date: '4月1日', title: '會議室使用說明', kind: '總務' },
    { stamp: '2026-02-18', date: '2月18日', title: '新人報到清單', kind: '人資' },
  ];

  readonly filteredRows = computed(() => {
    const keyword = this.query().trim();
    return this.rowsFor(this.panel()).filter((row) => this.matches(row, keyword));
  });

  readonly pageCount = computed(() => {
    const count = Math.ceil(this.filteredRows().length / PAGE_SIZE);
    return count || 1;
  });

  readonly pageNumbers = computed(() => {
    return Array.from({ length: this.pageCount() }, (_, index) => index + 1);
  });

  readonly pageRows = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredRows().slice(start, start + PAGE_SIZE);
  });

  readonly columns = computed((): BoardColumn[] => {
    if (this.panel() === 'notices') {
      return [
        { label: '日期', width: '108px' },
        { label: '主旨', width: '' },
        { label: '發布單位', width: '96px' },
        { label: '發布人', width: '88px' },
      ];
    }
    if (this.panel() === 'leave') {
      return [
        { label: '申請人', width: '88px' },
        { label: '假別', width: '72px' },
        { label: '期間', width: '' },
        { label: '狀態', width: '72px' },
      ];
    }
    if (this.panel() === 'notifications') {
      return [
        { label: '日期', width: '108px' },
        { label: '內容', width: '' },
      ];
    }
    return [
      { label: '日期', width: '108px' },
      { label: '文件', width: '' },
      { label: '分類', width: '96px' },
    ];
  });

  readonly feeds = computed((): InfoFeed[] => [
    { id: 'notices', title: '公告', summary: `${this.notices.length} 則`, count: this.notices.length },
    { id: 'leave', title: '請假', summary: `${this.leaveRequests.length} 筆待審`, count: this.leaveRequests.length },
    { id: 'notifications', title: '通知', summary: this.notes[0]?.text ?? '沒有通知', count: this.notes.length },
    { id: 'documents', title: '文件', summary: this.documents[0]?.title ?? '沒有文件', count: 0 },
  ]);

  readonly monthLabel = computed(() => {
    const cursor = this.monthCursor();
    return `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;
  });

  readonly monthDays = computed(() => {
    const cursor = this.monthCursor();
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const days: { stamp: string; day: number; isToday: boolean; titles: string[] }[] = [];
    for (let index = 0; index < leading; index += 1) {
      days.push({ stamp: '', day: 0, isToday: false, titles: [] });
    }
    for (let day = 1; day <= count; day += 1) {
      const stamp = this.localStamp(new Date(year, month, day));
      days.push({
        stamp,
        day,
        isToday: stamp === this.todayStamp,
        titles: this.companyEvents.filter((event) => event.stamp === stamp).map((event) => event.title),
      });
    }
    return days;
  });

  readonly selectedEvents = computed(() => {
    const stamp = this.selectedStamp();
    if (!stamp) return [];
    return this.companyEvents.filter((event) => event.stamp === stamp).map((event) => event.title);
  });

  readonly services = computed((): ServiceTile[] => {
    const systems = this.catalogSystems();
    if (!systems) return [];
    return systems
      .filter((system) => system.repo && system.repo !== 'noah-portal')
      .map((system) => ({
        label: system.name?.trim() || system.repo,
        icon: SERVICE_ICONS[system.repo] ?? 'app',
        href: appHref(system.repo, '', systems),
      }));
  });

  constructor() {
    const timer = window.setInterval(() => this.clock.set(new Date()), 30_000);
    const controller = new AbortController();
    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      controller.abort();
    });
    void loadCatalog(controller.signal).then((catalog) => {
      if (catalog) this.catalogSystems.set(catalog.systems);
    });
  }

  get displayName(): string {
    return this.employee()?.displayName || this.user()?.displayName || '—';
  }

  get initial(): string {
    const name = this.displayName.trim();
    if (!name || name === '—') return '·';
    return name.slice(0, 1).toUpperCase();
  }

  get employeeNumber(): string {
    return this.employee()?.employeeNumber || '';
  }

  get department(): string {
    return this.employee()?.department || '—';
  }

  get jobTitle(): string {
    return this.employee()?.jobTitle || '';
  }

  get clockLabel(): string {
    const time = this.clock();
    const hour = String(time.getHours()).padStart(2, '0');
    const minute = String(time.getMinutes()).padStart(2, '0');
    return `${hour}:${minute}`;
  }

  get punchAction(): string {
    const card = this.punch();
    if (card.leftAt) return '已下班';
    if (card.arrivedAt) return '下班打卡';
    return '上班打卡';
  }

  get hoursLabel(): string {
    const card = this.punch();
    if (!card.arrivedAt) return '—';
    const end = card.leftAt || this.clockLabel;
    const minutes = this.minutesBetween(card.arrivedAt, end);
    if (minutes < 1) return '不到 1 分';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest} 分`;
    if (rest === 0) return `${hours} 小時`;
    return `${hours} 小時 ${rest} 分`;
  }

  get panelTitle(): string {
    return this.feeds().find((feed) => feed.id === this.panel())?.title ?? '';
  }

  show(panel: InfoPanel): void {
    this.panel.set(panel);
    this.query.set('');
    this.page.set(1);
  }

  setQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.page.set(1);
  }

  goPage(page: number): void {
    this.page.set(page);
  }

  shiftPage(offset: number): void {
    const next = this.page() + offset;
    if (next < 1 || next > this.pageCount()) return;
    this.page.set(next);
  }

  shiftMonth(offset: number): void {
    const cursor = this.monthCursor();
    this.monthCursor.set(new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1));
    this.selectedStamp.set(null);
  }

  pickDay(stamp: string): void {
    this.selectedStamp.set(this.selectedStamp() === stamp ? null : stamp);
  }

  punchClock(): void {
    const card = this.punch();
    if (card.leftAt) return;
    const next = card.arrivedAt
      ? { arrivedAt: card.arrivedAt, leftAt: this.clockLabel }
      : { arrivedAt: this.clockLabel, leftAt: null };
    this.savePunch(next);
  }

  private rowsFor(panel: InfoPanel): BoardRow[] {
    if (panel === 'notices') {
      return this.notices.map((notice) => ({
        key: notice.stamp + notice.title,
        cells: [
          this.cell(notice.date, notice.stamp),
          this.cell(notice.title),
          this.cell(notice.unit),
          this.cell(notice.author),
        ],
      }));
    }
    if (panel === 'leave') {
      return this.leaveRequests.map((request) => ({
        key: request.name + request.when,
        cells: [
          this.cell(request.name),
          this.cell(request.kind),
          this.cell(request.when),
          this.cell('待審', '', true),
        ],
      }));
    }
    if (panel === 'notifications') {
      return this.notes.map((note) => ({
        key: note.stamp + note.text,
        cells: [
          this.cell(note.date, note.stamp),
          this.cell(note.text),
        ],
      }));
    }
    return this.documents.map((document) => ({
      key: document.stamp + document.title,
      cells: [
        this.cell(document.date, document.stamp),
        this.cell(document.title),
        this.cell(document.kind),
      ],
    }));
  }

  private cell(text: string, stamp = '', warning = false): BoardCell {
    return { text, stamp, warning };
  }

  private matches(row: BoardRow, keyword: string): boolean {
    if (!keyword) return true;
    return row.cells.some((item) => item.text.includes(keyword));
  }

  private savePunch(card: PunchCard): void {
    try {
      localStorage.setItem(CHECK_IN_KEY, JSON.stringify({
        date: this.todayStamp,
        arrivedAt: card.arrivedAt,
        leftAt: card.leftAt,
      }));
    } catch {
      return;
    }
    this.punch.set(card);
  }

  private readTodayPunch(): PunchCard {
    const empty = { arrivedAt: null, leftAt: null };
    try {
      const saved = localStorage.getItem(CHECK_IN_KEY);
      if (!saved) return empty;
      const legacyPrefix = `${this.todayStamp} `;
      if (saved.startsWith(legacyPrefix)) {
        return { arrivedAt: saved.slice(legacyPrefix.length), leftAt: null };
      }
      const parsed = JSON.parse(saved) as { date?: string; arrivedAt?: string | null; leftAt?: string | null };
      if (parsed.date !== this.todayStamp) return empty;
      return {
        arrivedAt: parsed.arrivedAt || null,
        leftAt: parsed.leftAt || null,
      };
    } catch {
      return empty;
    }
  }

  private minutesBetween(start: string, end: string): number {
    return this.minutesOf(end) - this.minutesOf(start);
  }

  private minutesOf(label: string): number {
    const [hour, minute] = label.split(':').map((part) => Number(part));
    return hour * 60 + minute;
  }

  private localStamp(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private formatToday(): string {
    const today = new Date();
    const day = new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric' }).format(today);
    const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'long' }).format(today);
    return `${day}，${weekday}`;
  }
}
