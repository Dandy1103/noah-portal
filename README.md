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

## 10. Keycloak 單一登入

### 本機驗證

在專案根目錄執行：

```powershell
node keycloak/create-local-env.mjs
docker compose --env-file .env.keycloak -f keycloak/compose.yaml up -d --build
npm.cmd ci
npm.cmd run build
node --env-file=.env.keycloak server/employees-cli.mjs migrate
node --env-file=.env.keycloak server/index.mjs
```

開啟 `http://localhost:3000/login`，點「使用員工帳號登入」。測試員工編號是 `e00123`，密碼是本機 `.env.keycloak` 裡的 `KEYCLOAK_DEMO_PASSWORD`。Keycloak 管理介面在 `http://localhost:8081/admin/`，管理員帳號是 `admin`，密碼取自同一檔案的 `KC_BOOTSTRAP_ADMIN_PASSWORD`。

若使用 `npm start` 開發畫面，保持後端執行，並將 `APP_ORIGIN` 改成 `http://localhost:4200`。Angular 會將 `/auth` 和 `/api` 轉發至後端。

### Railway 設定

Portal 使用根目錄的 `Dockerfile`，健康檢查路徑為 `/healthz`。Keycloak 可另開服務，以 `keycloak/Dockerfile` 建置品牌登入頁。上線時為 Keycloak 設定 HTTPS 網址 `login.dandy-cheng.com`、PostgreSQL 與正式 realm。建立 Portal 的 OIDC client，開啟 Client authentication 和 Standard flow，要求 S256 PKCE，登入回呼填 `https://noahportal.dandy-cheng.com/auth/callback`。

| 變數 | 值 |
|---|---|
| `APP_ORIGIN` | Portal 的 HTTPS 網址，例如 `https://noahportal.dandy-cheng.com` |
| `OIDC_ISSUER_URL` | Keycloak realm 的 HTTPS 網址，例如 `https://login.dandy-cheng.com/realms/noah` |
| `OIDC_CLIENT_ID` | Keycloak client ID |
| `OIDC_CLIENT_SECRET` | Keycloak client secret |
| `SESSION_SECRET` | 隨機值，至少 32 bytes。可以執行 `node -p "require('node:crypto').randomBytes(32).toString('hex')"` 產生 |
| `DATABASE_URL` | Portal 員工資料庫的 PostgreSQL 連線網址 |

Portal 登出會結束 Portal session 並回到登入頁。若 Keycloak 的登入狀態仍有效，再次登入時可沿用同一個帳號。

### 員工資料

用 Keycloak 管理登入帳號，用 Portal 的 PostgreSQL 存員工編號、姓名、部門和在職狀態。員工登入後可以在工作台看到自己的紀錄。

在 Keycloak 建立員工帳號後，從使用者頁面複製 **ID**。用這個 ID 把該帳號和員工資料連起來：

```powershell
node --env-file=.env.keycloak server/employees-cli.mjs add E00123 '測試員工' '資訊部' '<Keycloak 使用者 ID>'
```

相鄰的 `noah-hrm` 專案有新增員工表單。在 HRM 專案執行 `npm.cmd run build -- --base-href /hrm/`，再在 Portal 的本機 `.env.keycloak` 加上：

```dotenv
HRM_BROWSER_DIRECTORY=../noah-hrm/dist/noah-hrm/browser
HRM_ADMIN_SUBJECT=<負責新增員工的 Keycloak 使用者 ID>
```

重啟 Portal 後，開啟 `http://localhost:3000/hrm/`。登入的使用者必須符合 `HRM_ADMIN_SUBJECT` 才能新增。表單與 CLI 寫入同一張員工資料表。

Railway 上線時，為 Portal 提供 PostgreSQL 和 `DATABASE_URL`，再以該環境的變數執行 `node server/employees-cli.mjs migrate` 建表。

### HRM 本機開發接 develop

在 Railway 的 **develop 環境**部署這版 Portal，設定 `HRM_DEV_SSO_ENABLED=true`。使用 develop 的 Keycloak realm、員工資料庫與 `HRM_ADMIN_SUBJECT`。在 develop Keycloak 的 Portal client 的 **Valid redirect URIs** 加上 `http://localhost:4201/auth/hrm-dev/callback`。

在 `noah-hrm` 設定 develop Portal 網址後啟動 Angular 開發伺服器：

```powershell
$env:HRM_DEV_PORTAL_ORIGIN = 'https://<develop Portal 網址>'
npm.cmd start
```

開啟 `http://localhost:4201/`，點「登入」。Keycloak 登入完成後會回到本機 HRM。新增員工會寫入 develop 資料庫。
