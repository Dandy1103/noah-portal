# 網站部署手冊

安裝 `@dandy1103/ui` 的 GitHub 金鑰看 [GitHub Packages 金鑰](github-packages.md)。金鑰寫在 Windows 使用者環境變數，不要寫進 Git。

## 通用部署清單

### 1. 選 repo 和分支

在 Railway 新增服務，點 **GitHub Repo**，搜尋你的 repo，找到就點進去。接著打開這個服務的 **Settings → Source → Branch**，選你要部署的分支。 [Railway 分支設定](https://docs.railway.com/deployments/github-autodeploys#configure-the-github-branch-for-deployment-triggers)

### 2. 拿網站網址，設定 Keycloak

到服務的 **Settings → Networking → Public Networking**。用自己的網域就點 **Custom Domain**，填這個網站的完整網域，再到 DNS 把 Railway 顯示的 **CNAME** 和 **TXT** 各加一筆。用 Railway 給的網址就點 **Generate Domain**。 [Railway 網址設定](https://docs.railway.com/networking/domains/working-with-domains)

到 Keycloak 的 **Clients**，幫這個網站建一個 OpenID Connect client。開啟 **Client authentication** 和 **Standard flow**。到 **Valid redirect URIs** 貼上完整的登入回呼網址。像 Portal 這樣用 `/auth/callback` 的專案，就把這段加在網站網址後面。 [Keycloak Client 設定](https://www.keycloak.org/docs/latest/server_admin/#_oidc_clients)

像 Portal 和 HRM 這種程式本來就會送 `S256` 的專案，**PKCE method** 留空也能登入。選 `S256` 可以讓 Keycloak 強制要求它。 [Keycloak PKCE 說明](https://www.keycloak.org/docs/latest/server_admin/#_oidc_clients)

### 3. 填 5 筆設定，再按 Deploy

每個專案都要接資料庫和 Keycloak。回 Railway，點 **服務 → Variables → New Variable**，照表一筆一筆加。如果專案用了不同的欄位名稱，就照該專案 README 填。 [Railway 變數設定](https://docs.railway.com/variables)

| 名稱欄 | 值那欄填什麼 |
| --- | --- |
| `APP_ORIGIN` | 上一步拿到的 HTTPS 網址 |
| `OIDC_ISSUER_URL` | Keycloak realm 的網址。跟 Portal 用同一個 realm，就複製 Portal 服務裡同名的值。 |
| `OIDC_CLIENT_ID` | 上一步幫這個網站建的 Client ID |
| `OIDC_CLIENT_SECRET` | 到該 client 的 **Credentials** 複製 Client secret |
| `DATABASE_URL` | 這個專案要用的資料庫連線網址 |

如果網站還要在 Keycloak 新增、修改或停用帳號，再另外設定管理用的 client。填好後按 **Deploy**。等畫面顯示 **Active**，打開網站，試一次登入和儲存資料。

## HRM 獨立上線

從 `noah-hrm` 執行 `npm run build` 和 `mvnw.cmd package`，再從專案目錄啟動 `java -jar target/noah-hrm.jar`。Spring Boot 會提供 Angular 網頁、登入和員工 API。

HRM 用自己的機密 OIDC client。若 Portal 與 HRM 在同一個 Keycloak realm，員工可沿用 Keycloak 的登入狀態。兩個站點都要登錄自己的 /auth/callback。

在 HRM 服務設定 APP_ORIGIN、OIDC_ISSUER_URL、OIDC_CLIENT_ID、OIDC_CLIENT_SECRET、DATABASE_URL、HRM_ADMIN_SUBJECT、HRM_KEYCLOAK_CLIENT_ID 與 HRM_KEYCLOAK_CLIENT_SECRET。若要沿用同一個 realm 的既有員工資料，DATABASE_URL 指向該環境既有的員工資料庫。 [帳號管理設定](../README.md#帳號管理)

## 需要 SSO 的網站

Portal 目前使用 Cloud-IAM 上的 Keycloak realm `noah-identity`。新網站若由 Portal 提供頁面和 API，可以沿用 Portal session。若網站會有自己的網域和後端，為它建一個獨立的 Keycloak client，也可沿用同一套 Keycloak 登入。使用 OpenID Connect、Standard flow 和 PKCE `S256`。有後端保管 secret 的 client 開啟 **Client authentication**，把實際回呼網址填進 **Valid redirect URIs**。 [Keycloak Client 設定](https://www.keycloak.org/docs/latest/server_admin/#_oidc_clients)

Portal 回呼為 https://noahportal.dandy-cheng.com/auth/callback。本機 HRM 回呼為 http://localhost:4201/auth/callback。HRM 換 port 或部署到新網域時，在 HRM 自己的 Keycloak client 登錄回呼。 [Keycloak OIDC 設定](https://www.keycloak.org/securing-apps/oidc-layers)

這次在 Railway 的 Portal 服務新增了這些變數。日後接新的 Keycloak realm 或換網域時，可以照這張表對照。

| 變數 | Portal 的填法 |
| --- | --- |
| `APP_ORIGIN` | `https://noahportal.dandy-cheng.com` |
| `OIDC_ISSUER_URL` | `https://lemur-7.cloud-iam.com/auth/realms/noah-identity` |
| `OIDC_CLIENT_ID` | `noah-portal` |
| `OIDC_CLIENT_SECRET` | Keycloak 的 **Clients → noah-portal → Credentials** 裡的 Client secret |

Portal 的登入 session 由 Spring Boot 管理。

若要另開 Cloud-IAM 展示環境，可選 Freemium。部署完成後，Keycloak 管理介面首次登入用部署完成信裡提供的帳密。免費方案使用 Cloud-IAM 提供的網域，登入頁沿用供應商主題。 [Cloud-IAM 開通教學](https://documentation.cloud-iam.com/get-started/complete-tutorial.html) · [主題方案限制](https://documentation.cloud-iam.com/faq/customization.html)

## 本機登入（跟線上同一套 Cloud-IAM）

為什麼不走本機 `8081`：Cloud-IAM 免費方案改不了登入頁主題，本機若另起 Keycloak 會變成兩套登入體驗。所以本機、正式都打同一個 realm：

`https://lemur-7.cloud-iam.com/auth/realms/noah-identity`

管理台：[noah-identity console](https://lemur-7.cloud-iam.com/auth/admin/noah-identity/console/)

### 一次性：在 Cloud-IAM 放行本機回呼

| Client | Valid redirect URIs 至少要有 | Web origins 建議加 |
| --- | --- | --- |
| `noah-portal` | `http://localhost:4200/auth/callback` | `http://localhost:4200` |
| `noah-hrm` | `http://localhost:4201/auth/callback` | `http://localhost:4201` |

正式網址也一起留著：`https://noahportal.dandy-cheng.com/auth/callback`、`https://noahhrm.dandy-cheng.com/auth/callback`。

漏加本機回呼時，畫面會是 **Invalid parameter: redirect_uri**。

### 每個專案寫 `.env.local`

**Portal**

```cmd
cd noah-portal
copy .env.local.example .env.local
```

打開 `.env.local` 填：

| 欄位 | 去哪拿 |
| --- | --- |
| `OIDC_CLIENT_SECRET` | Cloud-IAM → Clients → `noah-portal` → Credentials |
| `DATABASE_URL` | 本機 Postgres 用 `.env.shared-keycloak` 那串；或貼 Railway／共用庫連線 |
| `HRM_ADMIN_SUBJECT` | （可選）管理員在 Cloud-IAM 的 User ID |
| `HRM_KEYCLOAK_CLIENT_SECRET` | （帳號管理才要）Clients → `noah-hrm-management` → Credentials |

`OIDC_ISSUER_URL`、`OIDC_CLIENT_ID` 範本已寫好，通常不用改。

**HRM** 同理：複製 `noah-hrm/.env.local.example`，client 改拿 `noah-hrm` 的 secret。

有 `.env.local` 且裡面有 `OIDC_ISSUER_URL` 時，`npm start` **不會**再起本機 `8081`。改完 `.env.local` 一定要重跑 `npm start`。

### 日常啟動

```cmd
cd noah-portal
npm start
```

瀏覽器開 `http://localhost:4200/`，應跳到 `lemur-7.cloud-iam.com`，不是 `localhost:8081`。

```cmd
cd noah-hrm
npm start
```

開 `http://localhost:4201/`。兩邊同一個 Cloud-IAM realm，登過一邊通常不用再打一次密碼。

### Port 速查

| Port | 誰 |
| --- | --- |
| `4200` | Portal 前端 |
| `4201` | HRM 前端 |
| `3000` | Portal 後端（`/auth`、`/api`） |
| `3001` | HRM 後端 |
| `5433` | 本機 Postgres（有起 Docker 時） |
| `8081` | 本機 Keycloak 備援（只有**沒有** `.env.local` 才會用） |

換 HRM 前端 port：`$env:HRM_PORT = "4202"` 再 `npm start`，並在 Cloud-IAM 的 `noah-hrm` client 加上對應 callback。

新站接 SSO：自建 client、Standard flow、放 secret、`Valid redirect URIs` 填實際 callback、`APP_ORIGIN` 填瀏覽器開的網址。

真的要暫時用本機 Keycloak：刪掉或改名 `.env.local` 再 `npm start`（僅備援）。

## 遇到問題先查哪裡

| 畫面或錯誤 | 先查 |
| --- | --- |
| `git push` 回 403 | 看錯誤裡的 GitHub 帳號和 `git remote -v`。這次 HRM 的 repo 是 `Dandy1103/noah-hrm`，Git 卻用 `1103syike`。在 HRM repo 執行表格下方的指令。 [GitHub 驗證](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github) |
| Railway 選不到 repo | 去 GitHub **Settings → Applications → Installed GitHub Apps**，確認 Railway App 已安裝且有權存取該 repo。 [GitHub App 存取設定](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps) |
| Push 後沒有新部署 | 到 Railway **Settings → Source** 核對環境、repo、分支與自動部署狀態，再查 **Deployments**。 |
| Spaceship 提示 TXT 和 CNAME 衝突 | 回 Railway 的 **Show DNS records**，把驗證 TXT 的專用 Host 和驗證值一起複製。CNAME 則使用網站子網域的 Host。 |
| HRM 本機登入回 500 | 查 `3001` 有沒有起來；`.env.local` 的 issuer／secret／`DATABASE_URL` 對不對。 |
| Portal `4200` 登入回 500 | 查 `3000` 有沒有起來；`.env.local` 有沒有被讀到（改完要重啟）；Cloud-IAM 能不能連。 |
| 還跳到 `localhost:8081` | 專案根目錄沒有有效的 `.env.local`（或缺 `OIDC_ISSUER_URL`）。 |
| `Invalid parameter: redirect_uri` | Cloud-IAM 該 client 的 **Valid redirect URIs** 缺本機 callback，例如 `http://localhost:4200/auth/callback`。 |
| 部署 Active，但登入 `unavailable` | 查 Railway 的 `OIDC_ISSUER_URL`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`；看 Deploy Logs。 |
| HRM 顯示「請用有新增員工權限的帳號登入」 | 登入已完成，查 Railway 的 `HRM_ADMIN_SUBJECT` 是否等於目前登入帳號在當前 realm 的 **User ID**。 |
| HRM 能開表單，但儲存失敗 | 確認 HRM 的 `DATABASE_URL`、資料表遷移、Keycloak 管理 client 的 ID、secret 和 `manage-users` 權限。若提示已使用，再查員工編號或電子郵件是否重複。 |

Windows 上使用 Git Credential Manager 時，可用這組指令選定要推送的 GitHub 帳號。其他 repo 把 `Dandy1103` 換成有寫入權限的帳號。

```cmd
git credential-manager github login --username Dandy1103 --browser
git config --local credential.https://github.com.username Dandy1103
git push --dry-run origin HEAD
```
