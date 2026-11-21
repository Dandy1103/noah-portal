import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const server = 'http://localhost:8081';
const realm = '/admin/realms/noah-local';
const managementId = 'noah-hrm-management';
export const demoLogin = 'h247386514';

export async function configureLocalKeycloak(adminPassword, loginClientId, port, savedAdminSubject) {
    const response = await fetch(server + '/realms/master/protocol/openid-connect/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: 'admin-cli',
            grant_type: 'password',
            username: 'admin',
            password: adminPassword,
        }),
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('本機 Keycloak 管理員登入失敗。請確認本機 Keycloak 的管理員密碼。');
    const { access_token: token } = await response.json();

    async function request(path, method = 'GET', body, missingAllowed = false) {
        const result = await fetch(server + realm + path, {
            method,
            headers: {
                authorization: 'Bearer ' + token,
                ...(body && { 'content-type': 'application/json' }),
            },
            body: body && JSON.stringify(body),
            signal: AbortSignal.timeout(6000),
        });
        if (missingAllowed && result.status === 404) return null;
        if (method === 'POST' && path === '/clients' && result.status === 409) return;
        if (!result.ok) throw new Error(`本機 Keycloak 設定失敗（HTTP ${result.status}）。`);
        if (result.headers.get('content-type')?.includes('application/json')) return result.json();
    }

    const lookup = (id) => request('/clients?clientId=' + encodeURIComponent(id));
    let [login] = await lookup(loginClientId);
    const callback = "http://localhost:" + port + "/auth/callback";
    if (!login) {
        await request('/clients', 'POST', {
            clientId: loginClientId, enabled: true, protocol: "openid-connect",
            publicClient: false, clientAuthenticatorType: "client-secret", secret: randomBytes(32).toString("hex"),
            standardFlowEnabled: true, implicitFlowEnabled: false, directAccessGrantsEnabled: false,
            redirectUris: [callback], attributes: { "pkce.code.challenge.method": "S256" },
        });
        [login] = await lookup(loginClientId);
    }
    if (!login?.standardFlowEnabled || login.publicClient) throw new Error("本機登入 client 設定不正確。");
    if (!(login.redirectUris ?? []).includes(callback)) {
        await request('/clients/' + login.id, 'PUT', { redirectUris: [...(login.redirectUris ?? []), callback] });
    }

    const clientId = managementId;
    let [management] = await request('/clients?clientId=' + encodeURIComponent(clientId));
    if (!management) {
        await request('/clients', 'POST', {
            clientId, name: 'Noah HRM Account Management', enabled: true, protocol: 'openid-connect',
            publicClient: false, clientAuthenticatorType: 'client-secret',
            secret: randomBytes(32).toString('hex'),
            serviceAccountsEnabled: true, fullScopeAllowed: false, standardFlowEnabled: false,
            implicitFlowEnabled: false, directAccessGrantsEnabled: false,
        });
        [management] = await request('/clients?clientId=' + encodeURIComponent(clientId));
    }
    if (!management?.serviceAccountsEnabled || management.publicClient || management.id === login.id) {
        throw new Error('HRM 的 Keycloak 管理 client 必須是啟用服務帳號的獨立 client。');
    }

    const [rolesClient] = await request('/clients?clientId=realm-management');
    const role = await request('/clients/' + rolesClient.id + '/roles/manage-users');
    const service = await request('/clients/' + management.id + '/service-account-user');
    for (const path of [
        '/users/' + service.id + '/role-mappings/clients/' + rolesClient.id,
        '/clients/' + management.id + '/scope-mappings/clients/' + rolesClient.id,
    ]) {
        if (!(await request(path)).some((item) => item.id === role.id)) await request(path, 'POST', [role]);
    }
    const requiredScope = (await request('/client-scopes')).find((scope) => scope.name === 'kc-admin-api');
    if (requiredScope) {
        const scopes = await request('/clients/' + management.id + '/default-client-scopes');
        if (!scopes.some((scope) => scope.id === requiredScope.id)) {
            await request('/clients/' + management.id + '/default-client-scopes/' + requiredScope.id, 'PUT');
        }
    }

    const { value: secret } = await request('/clients/' + management.id + '/client-secret');
    const profile = await request('/users/profile');
    const username = profile.attributes.find((attribute) => attribute.name === 'username');
    if (!username) throw new Error('找不到本機 Keycloak 的帳號欄位。');
    if (JSON.stringify(username.permissions?.edit) !== '["admin"]') {
        username.permissions = { ...username.permissions, edit: ['admin'] };
        await request('/users/profile', 'PUT', profile);
    }
    const settings = await request('');
    if (!settings.editUsernameAllowed) await request('', 'PUT', { editUsernameAllowed: true });

    let demo = savedAdminSubject ? await request('/users/' + encodeURIComponent(savedAdminSubject), 'GET', undefined, true) : null;
    if (!demo) {
        const matches = await request('/users?email=e00123%40example.test&exact=true');
        [demo] = matches;
    }
    if (demo?.email === 'e00123@example.test' && ['e00123', 'a100000000'].includes(demo.username)) {
        await request('/users/' + demo.id, 'PUT', { username: demoLogin });
        const renamed = await request('/users/' + demo.id);
        if (renamed?.username !== demoLogin) throw new Error('本機測試帳號未能改名。');
        demo = renamed;
    }
    if (!demo?.id || !secret) throw new Error('找不到本機 HRM 管理帳號或管理憑證。');
    const { value: loginSecret } = await request('/clients/' + login.id + '/client-secret');
    if (!loginSecret) throw new Error("找不到本機登入 client 的憑證。");
    return {
        OIDC_CLIENT_ID: loginClientId,
        OIDC_CLIENT_SECRET: loginSecret,
        HRM_KEYCLOAK_CLIENT_ID: clientId,
        HRM_KEYCLOAK_CLIENT_SECRET: secret,
        HRM_ADMIN_SUBJECT: demo.id,
    };
}

export async function waitForLocalKeycloak() {
    const endpoint = server + '/realms/noah-local/.well-known/openid-configuration';
    for (let attempt = 0; attempt < 45; attempt++) {
        const result = await fetch(endpoint, { signal: AbortSignal.timeout(2000) }).catch(() => null);
        if (result?.ok) return;
        await sleep(2000);
    }
    throw new Error('本機 Keycloak 還沒就緒。請到 Docker Desktop 查看 keycloak 容器的日誌。');
}
