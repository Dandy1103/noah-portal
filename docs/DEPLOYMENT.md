# 網站部署手冊

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

## 本機 HRM

在 `noah-hrm` 執行 `npm start`，開啟 [HRM](http://localhost:4201/)。它會和 Portal 共用本機 Keycloak 及員工資料庫。要接線上測試環境時，依 `.env.local.example` 填寫 Keycloak 和 PostgreSQL 設定。

## 本機開發 port 和登入回呼

Windows 新電腦先裝 Node.js 20.12 以上、Git 和 Docker Desktop。Portal 和 HRM 都在各自的專案目錄執行 `npm start`。

| Port | 用途 |
| --- | --- |
| `4200` | Portal 的 Angular 前端 |
| `4201` | HRM 的 Angular 前端 |
| `3000` | 本機 Portal 後端，處理 `/auth` 和 `/api` |
| `3001` | 本機 HRM 後端，處理 `/auth` 和 `/api` |
| `8081` | Portal 與 HRM 共用的本機 Keycloak |
| `5433` | Portal 與 HRM 共用的本機 PostgreSQL |
| `4202`、`4203` | 下個專案可以使用的例子，實際選一個未被占用的 port |

### 讓 Portal 在 4200 登入

`npm start` 會啟動 Portal 的前端和後端。`/auth` 和 `/api` 會由 `proxy.conf.json` 轉發到 `127.0.0.1:3000`。登入回 500 時，先確認後端有在跑，再確認後端能連到 Keycloak。

從 `noah-portal` 開 PowerShell，先啟動專案的 Docker Compose，再啟動後端。這段指令假設本機已有 `.env.keycloak`，初次建立可照 [README 本機驗證](../README.md#本機驗證)。

```powershell
docker compose --env-file .env.keycloak -f keycloak/compose.yaml up -d --build
$env:APP_ORIGIN = 'http://localhost:4200'
.\mvnw.cmd spring-boot:run
```

保留這個視窗，在另一個視窗執行 `npm.cmd run ng -- serve` 啟動前端。開啟 [本機 Portal](http://localhost:4200/) 測試登入。Keycloak 的 Portal client 要允許 `http://localhost:4200/auth/callback`。專案的本機 realm 範本已包含這筆回呼，已建立的 realm 請到 Keycloak 管理介面核對。 [Keycloak Client 設定](https://www.keycloak.org/docs/latest/server_admin/#_oidc_clients)

### 給新專案選 port

新 Angular 專案如果保留預設的 `"start": "ng serve"`，臨時換 port 可以在它自己的 repo 執行下面任一行。要讓團隊每次都使用同一個 port，可把 `--port 4202` 寫入該 repo 的 `package.json` 啟動指令。 [Angular ng serve](https://angular.dev/cli/serve)

```cmd
npm.cmd start -- --port 4202
npm.cmd start -- --port 4203
```

新專案要接 SSO 時，核對下面三處：

1. **前端網址**用你選的 port。沿用 Portal 這種前後端架構時，後端的 `APP_ORIGIN` 要填瀏覽器實際開的網址，例如 `http://localhost:4202`。
2. **代理設定**的目標填後端真正監聽的 port。只改前端 port 時，Portal 的代理仍可指向 `3000`。
3. **Keycloak 回呼**填該應用實際的完整 callback。若新專案的路徑是 `/auth/callback`，就填 `http://localhost:4202/auth/callback`。 [Keycloak 回呼設定](https://www.keycloak.org/docs/latest/server_admin/#_oidc_clients)

在 PowerShell 設定 `$env:HRM_PORT = "4202"` 再啟動 HRM，就能換前端 port。使用預設的本機 Keycloak 時會自動登錄回呼。使用線上測試環境時，需在 HRM client 加上 `http://localhost:4202/auth/callback`。

多個本機專案各自管理登入 session 時，給每個專案不同的 session cookie 名稱，避免互相覆蓋。同一個 `localhost` 的 cookie 會跨 port 共用。 [HTTP cookie 規格](https://www.rfc-editor.org/rfc/rfc6265.html#section-8.5)

## 遇到問題先查哪裡

| 畫面或錯誤 | 先查 |
| --- | --- |
| `git push` 回 403 | 看錯誤裡的 GitHub 帳號和 `git remote -v`。這次 HRM 的 repo 是 `Dandy1103/noah-hrm`，Git 卻用 `1103syike`。在 HRM repo 執行表格下方的指令。 [GitHub 驗證](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github) |
| Railway 選不到 repo | 去 GitHub **Settings → Applications → Installed GitHub Apps**，確認 Railway App 已安裝且有權存取該 repo。 [GitHub App 存取設定](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps) |
| Push 後沒有新部署 | 到 Railway **Settings → Source** 核對環境、repo、分支與自動部署狀態，再查 **Deployments**。 |
| Spaceship 提示 TXT 和 CNAME 衝突 | 回 Railway 的 **Show DNS records**，把驗證 TXT 的專用 Host 和驗證值一起複製。CNAME 則使用網站子網域的 Host。 |
| HRM 本機登入回 500 | 查 HRM 後端 `3001` 和 Keycloak `8081` 是否已啟動。使用線上測試環境時，核對 `.env.local` 的 OIDC 設定。 |
| Portal 的 `4200` 打得開，登入回 500 | 確認本機 Portal 後端 `3000` 和本機 Keycloak `8081` 都在跑，再查 `APP_ORIGIN` 和 `4200` 的回呼設定。 |
| 部署 Active，但登入顯示 `unavailable` | 查 `OIDC_ISSUER_URL`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`，並確認 Keycloak 的公開 OpenID 設定能連線。Spring Boot 的 **Deploy Logs** 會記錄失敗的階段。 |
| Keycloak 顯示 `Invalid parameter: redirect_uri` | 到該 client 的 **Valid redirect URIs** 核對完整網址，包含協定、網域或 localhost port，以及回呼路徑。 |
| HRM 顯示「請用有新增員工權限的帳號登入」 | 登入已完成，查 Railway 的 `HRM_ADMIN_SUBJECT` 是否等於目前登入帳號在當前 realm 的 **User ID**。 |
| HRM 能開表單，但儲存失敗 | 確認 HRM 的 `DATABASE_URL`、資料表遷移、Keycloak 管理 client 的 ID、secret 和 `manage-users` 權限。若提示已使用，再查員工編號或電子郵件是否重複。 |

Windows 上使用 Git Credential Manager 時，可用這組指令選定要推送的 GitHub 帳號。其他 repo 把 `Dandy1103` 換成有寫入權限的帳號。

```cmd
git credential-manager github login --username Dandy1103 --browser
git config --local credential.https://github.com.username Dandy1103
git push --dry-run origin HEAD
```
