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

## 10. 展示環境與 Microsoft Entra SSO

### 本機驗證

執行 `npm ci`、`npm run build`，接著執行 `npm run start:server`。開啟 `http://localhost:3000` 可查看登入頁。填妥 `.env` 後，改用 `node --env-file=.env server/index.mjs` 啟動後端以測試公司帳號登入。可複製 `.env.example` 作為設定範本。

若使用 `npm start` 開發畫面，保持後端執行，並將 `APP_ORIGIN` 設為 `http://localhost:4200`。Angular 開發伺服器會將 `/auth` 和 `/api` 轉發至後端。Entra 登入回呼需使用相同的 origin。

### Railway 部署順序

1. 從這個分支部署 GitHub repo，讓 Railway 使用根目錄的 `Dockerfile` 建置 Portal。服務使用 Railway 提供的 `PORT`，Healthcheck Path 設為 `/healthz`。
2. 在服務的 **Networking** 選擇 **Generate Domain**。先用產生的 HTTPS 網址檢查登入頁能開啟。
3. 在 Microsoft Entra ID 的 **App registrations** 建立單一租戶的 Web 應用。新增 `https://<Railway 網域>/auth/callback` 為 **Web** redirect URI。到 **Certificates & secrets** 建立 Client Secret，使用其 **Value**。
4. 在 Railway 服務的 **Variables** 設定下表，重新部署。
5. 用公司測試帳號驗證登入、工作台、重新整理及登出。登出會結束 Portal 的 session 並直接回到 `/login`。使用者重新登入時，可以沿用 Microsoft 的 SSO session。

| 變數 | 值 |
|---|---|
| `APP_ORIGIN` | Railway 公開 HTTPS 網址，例如 `https://noah-portal.up.railway.app` |
| `ENTRA_TENANT_ID` | Entra 的 Directory (tenant) ID |
| `ENTRA_CLIENT_ID` | Entra 的 Application (client) ID |
| `ENTRA_CLIENT_SECRET` | Entra Client Secret 的 **Value**，只存於 Railway Variables 或本機 `.env` |
| `ENTRA_EMPLOYEE_LOGIN_DOMAIN` | 員工 Entra 登入名稱中 `@` 後的網域，例如 `company.onmicrosoft.com` |
| `SESSION_SECRET` | 隨機值，至少 32 bytes。可以執行 `node -p "require('node:crypto').randomBytes(32).toString('hex')"` 產生 |

員工編號登入使用 Entra 帳號的登入名稱（UPN）。例如輸入 `E00123`，Portal 會預填 `E00123@company.onmicrosoft.com` 並由 Microsoft 驗證。請在 Entra 建立或確認一筆符合這個規則的測試帳號。

展示環境使用單一實例保存 session。服務重新部署或重啟後，使用者需重新登入。
