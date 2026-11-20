# Noah Portal

企業內部入口平台（Enterprise Portal）。

使用 Angular 17 開發，提供統一的企業內部系統入口，整合使用者資訊、系統應用、通知及管理功能，作為未來企業內部各項管理系統的整合平台。

---

## 1. 專案介紹

Noah Portal 是一套企業內部入口平台，目標是建立統一的系統操作入口，讓使用者能夠透過單一平台存取企業內部服務。

本專案採用模組化架構設計，並遵循 Git Flow 開發流程，方便後續擴充及整合其他企業管理系統。

## 2. 技術架構

| 技術 | 用途 |
|---|---|
| Angular 17 | 前端框架 |
| TypeScript | 開發語言 |
| SCSS | 樣式管理 |
| RxJS | 非同步資料流處理 |
| Angular Router | 路由管理 |
| Reactive Forms | 表單管理 |
| Git | 版本控制 |
| GitHub | 原始碼管理 |

## 3. 系統功能規劃

| 模組 | 功能說明 |
|---|---|
| Dashboard | 企業入口首頁 |
| Application Portal | 企業內部系統應用入口 |
| User Profile | 使用者個人資料 |
| Notification | 系統通知中心 |
| Authentication | 登入與身分驗證 |
| System Management | 系統及平台管理 |

## 4. 專案架構

採用 Feature-Based Architecture，依照業務功能劃分模組。

```text
src/
└── app/
    ├── core/
    │   ├── guards/
    │   ├── interceptors/
    │   ├── models/
    │   └── services/
    │
    ├── shared/
    │   ├── components/
    │   ├── directives/
    │   └── pipes/
    │
    ├── layout/
    │   ├── header/
    │   ├── sidebar/
    │   └── main-layout/
    │
    ├── features/
    │   ├── dashboard/
    │   ├── applications/
    │   ├── profile/
    │   ├── notifications/
    │   ├── auth/
    │   └── settings/
    │
    └── app.routes.ts
```

## 5. Git 開發規範

採用簡化版 Git Flow。

### 5.1 Branch Strategy

| Branch | 用途 |
|---|---|
| main | 正式穩定版本 |
| develop | 開發整合分支 |
| feature/* | 新功能開發 |
| fix/* | 錯誤修復 |
| refactor/* | 程式碼重構 |
| release/* | 版本發布 |
| hotfix/* | 正式版本緊急修復 |

### 5.2 Branch Naming Convention

統一採用以下命名格式：

```text
feature/{module}/{function}
fix/{module}/{issue}
refactor/{module}/{target}
release/{version}
hotfix/{module}/{issue}
```

範例：

```text
feature/project/initial-setup
feature/auth/login
feature/dashboard/overview
feature/applications/application-list
feature/notifications/notification-center

fix/auth/login-validation
refactor/dashboard/components

release/1.0.0
hotfix/auth/session-error
```

### 5.3 Git Flow

```text
main
  │
  └── develop
        │
        ├── feature/project/initial-setup
        ├── feature/auth/login
        ├── feature/dashboard/overview
        └── feature/applications/application-list
```

開發流程：

1. 從 develop 建立 Feature Branch。
2. 在 Feature Branch 進行功能開發。
3. 完成後進行 Commit。
4. Push 至 GitHub。
5. 建立 Pull Request。
6. 檢查程式碼及測試結果。
7. 合併至 develop。
8. 刪除已完成的 Feature Branch。

禁止直接在 main 與 develop 進行功能開發。

## 6. Commit Message Convention

採用 Conventional Commits。

格式：

```text
type: description
```

| Type | 用途 |
|---|---|
| feat | 新增功能 |
| fix | 修復錯誤 |
| style | 樣式調整 |
| refactor | 程式碼重構 |
| docs | 文件修改 |
| chore | 專案設定及維護 |

範例：

```text
feat: add dashboard layout
fix: resolve login validation
style: update sidebar layout
refactor: simplify navigation service
docs: update project documentation
chore: configure angular project
```

Commit Message 統一使用英文，保持簡短且具體。

## 7. 開發原則

- 採用模組化架構。
- 保持元件職責單一。
- 共用功能集中管理。
- 遵守一致的命名規範。
- 避免重複程式碼。
- 所有功能透過 Feature Branch 開發。
- 維持 Git Commit 歷史清晰。

## 8. 開發環境

安裝依賴：

```bash
npm install
```

啟動開發伺服器：

```bash
ng serve
```

執行建置：

```bash
ng build
```

執行測試：

```bash
ng test
```

---

## 9. 開發狀態

目前專案以 Portal 基礎架構及核心功能為主要開發目標，後續將逐步擴充企業內部應用整合能力。