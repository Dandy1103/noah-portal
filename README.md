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
| Java 21、Spring Boot、Maven | Portal 與 HRM 各自啟動後端 |
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

新網站部署、HRM 上線與常見錯誤請看 [網站部署手冊](docs/DEPLOYMENT.md)。

### 本機驗證

#### Windows 一鍵啟動

新電腦準備 Node.js 20.12 以上、Git 和 Docker Desktop。開啟 Docker Desktop 後，在 `noah-portal` 根目錄執行：

```cmd
npm start
```

指令會準備本機設定、Keycloak、PostgreSQL、JDK 21 和 Maven，並啟動 Portal 的 Angular 與 API。看到啟動完成後開 [本機 Portal](http://localhost:4200/)，未登入時會直接前往 Keycloak。

在 `noah-hrm` 執行 `npm start`，開啟 [本機 HRM](http://localhost:4201/)。

本機 Portal 首頁的「Noah HRM」預設連到 `http://localhost:4201/`。HRM 換 port 或獨立部署後，在 Portal 設定 `HRM_URL` 為 HRM 的網址。

兩個專案共用本機 Keycloak 與員工資料庫。測試登入字號為 `H247386514`（測試專用），初始密碼在 `.env.shared-keycloak` 的 `KEYCLOAK_DEMO_PASSWORD`。登入後點「變更密碼」，新密碼可登入兩邊。按 `Ctrl+C` 會停止目前專案的前端和後端，Docker 裡的 Keycloak 和 PostgreSQL 會留在背景。

第一次使用新的員工資料庫時，先在 `noah-hrm` 執行 `npm run db:migrate` 或啟動 HRM，再啟動 Portal。

#### 手動啟動

先準備 JDK 21、Node.js 和 Docker Desktop。在專案根目錄執行：

```powershell
node keycloak/create-local-env.mjs
docker compose --env-file .env.keycloak -f keycloak/compose.yaml up -d --no-recreate
npm.cmd ci
npm.cmd run build
.\mvnw.cmd spring-boot:run
```

開啟 `http://localhost:3000/`，瀏覽器會前往 Keycloak。測試登入字號為 `H247386514`。若跑過 `npm start`，初始員工密碼與 Keycloak 管理員密碼可在 `.env.shared-keycloak` 分別查看 `KEYCLOAK_DEMO_PASSWORD` 和 `KC_BOOTSTRAP_ADMIN_PASSWORD`。管理員帳號是 `admin`，管理介面在 `http://localhost:8081/admin/`。

若要分開啟動，先設定 `$env:APP_ORIGIN = 'http://localhost:4200'` 再啟動 Spring Boot，接著在另一個視窗執行 `npm run ng -- serve` 啟動 Angular。Angular 會將 `/auth` 和 `/api` 轉發至後端。Spring Boot 會讀取專案根目錄的 `.env.keycloak`，終端機的同名變數優先。

### Railway 設定

Portal 使用根目錄的 `Dockerfile`，健康檢查路徑為 `/healthz`。Keycloak 可另開服務，以 `keycloak/Dockerfile` 建置品牌登入頁。上線時為 Keycloak 設定 HTTPS 網址 `login.dandy-cheng.com`、PostgreSQL 與正式 realm。建立 Portal 的 OIDC client，開啟 Client authentication 和 Standard flow，要求 S256 PKCE，登入回呼填 `https://noahportal.dandy-cheng.com/auth/callback`。

| 變數 | 值 |
|---|---|
| `APP_ORIGIN` | Portal 的 HTTPS 網址，例如 `https://noahportal.dandy-cheng.com` |
| `OIDC_ISSUER_URL` | Keycloak realm 的 HTTPS 網址，例如 `https://login.dandy-cheng.com/realms/noah` |
| `OIDC_CLIENT_ID` | Keycloak client ID |
| `OIDC_CLIENT_SECRET` | Keycloak client secret |
| `DATABASE_URL` | Portal 員工資料庫的 PostgreSQL 連線網址 |

Portal 和 HRM 登出時會結束目前網站的工作階段，再透過 Keycloak 結束單一登入並回到 Keycloak 登入頁。

### 員工資料

用 Keycloak 管理登入帳號，用 Portal 的 PostgreSQL 存員工編號、姓名、部門和在職狀態。員工登入後可以在工作台看到自己的紀錄。

在 Keycloak 建立員工帳號後，從使用者頁面複製 **ID**。用這個 ID 把該帳號和員工資料連起來：

```powershell
.\mvnw.cmd package
java -jar target/noah-portal.jar link E00123 '測試員工' '資訊部' '<Keycloak 使用者 ID>'
```

員工帳號管理由 HRM 提供。Portal 如需顯示同一份員工資料，請使用同一個 Keycloak realm 與員工資料庫。

員工資料表由 HRM 的 Flyway 遷移維護。Portal 的 `DATABASE_URL` 指向已完成遷移的 PostgreSQL。有資料表變更時，先部署 HRM 並確認遷移成功，再部署需要新欄位的 Portal。

### 帳號管理

HRM 用身分證字號建立 Keycloak 登入帳號，員工資料仍使用員工編號。新增時會驗證字號的格式和檢查碼。員工首次登入需更改初始密碼。已由 HRM 管理的員工可在修改帳號時填入新字號。以 CLI 手動連結的帳號可在 Keycloak 管理介面修改。 [國民身分證統一編號檢查方法](https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg027242/ch04/type2/gov30/num8/images/BB.pdf)

線上環境若要讓 HRM 更新登入字號，在 Keycloak 的 **Realm settings → User profile → username** 將編輯權限設為 **Admin**，並在 **Realm settings → Login** 開啟 **Edit username**。已登入的員工可照常自行變更密碼。 [Keycloak 使用者屬性設定](https://www.keycloak.org/docs/latest/server_admin/#_user-profile)

在 Portal 使用的 Keycloak realm 另建一個管理 client，例如 `noah-hrm-management`。開啟 **Client authentication** 和 **Service accounts roles**，關閉 **Standard flow** 與 **Direct access grants**。在 **Service account roles** 指派 `realm-management` 的 `manage-users`，並在該 client 的專用 scope 允許這個角色。 [Keycloak Service Account 設定](https://www.keycloak.org/docs/latest/server_admin/#_service_accounts)

Keycloak 26.8.2 的管理 API 也需要 `kc-admin-api`。在管理 client 的 **Client scopes** 把它加成 **Default**。 [Keycloak 升級說明](https://www.keycloak.org/docs/26.8.2/upgrading/)

把管理 client 的 ID 和 secret 設成 Portal 後端的 `HRM_KEYCLOAK_CLIENT_ID` 與 `HRM_KEYCLOAK_CLIENT_SECRET`。本機放 `.env.keycloak`，線上放 Portal 服務的 Railway Variables。
