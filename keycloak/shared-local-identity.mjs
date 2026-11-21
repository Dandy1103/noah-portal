
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { configureLocalKeycloak, waitForLocalKeycloak } from './setup-local-hrm.mjs';

const issuer = 'http://localhost:8081/realms/noah-local';
const stack = 'keycloak';
const random = () => randomBytes(32).toString('hex');

function fromContainer(docker, container, keys) {
    const command = spawnSync(docker, ['inspect', '--format', '{{json .Config.Env}}', container], {
        encoding: 'utf8', windowsHide: true,
    });
    if (command.status !== 0) throw new Error('找不到本機 Docker 容器 ' + container + '。');
    const values = Object.fromEntries(JSON.parse(command.stdout).map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
    }));
    for (const key of keys) {
        if (!values[key]) throw new Error('本機 Docker 容器缺少 ' + key + '。');
    }
    return Object.fromEntries(keys.map((key) => [key, values[key]]));
}

export async function startLocalIdentity(docker, root, bootstrap, clientId, port, composeFile = 'keycloak/shared-compose.yaml') {
    const credentialFile = join(root, ".env.shared-keycloak");
    const saved = existsSync(credentialFile) ? parseEnv(readFileSync(credentialFile, "utf8")) : {};
    const compose = spawnSync(docker, [
        'compose', '--project-name', stack, '--env-file', '.env.keycloak',
        '-f', composeFile, 'up', '-d', '--no-recreate', '--wait',
    ], {
        cwd: root, stdio: 'inherit',
        env: {
            ...process.env,
            OIDC_CLIENT_SECRET: saved.OIDC_CLIENT_SECRET || bootstrap.OIDC_CLIENT_SECRET || random(),
            KC_BOOTSTRAP_ADMIN_PASSWORD: saved.KC_BOOTSTRAP_ADMIN_PASSWORD || bootstrap.KC_BOOTSTRAP_ADMIN_PASSWORD || random(),
            KEYCLOAK_DEMO_PASSWORD: saved.KEYCLOAK_DEMO_PASSWORD || bootstrap.KEYCLOAK_DEMO_PASSWORD || random(),
            PORTAL_DB_PASSWORD: saved.PORTAL_DB_PASSWORD || bootstrap.PORTAL_DB_PASSWORD || random(),
        },
    });
    if (compose.status !== 0) throw new Error('共用的本機 Keycloak 或 PostgreSQL 啟動失敗，請查看 Docker 訊息。');

    const keycloak = fromContainer(docker, stack + '-keycloak-1', [
        'KC_BOOTSTRAP_ADMIN_PASSWORD', 'KEYCLOAK_DEMO_PASSWORD',
    ]);
    const postgres = fromContainer(docker, stack + '-portal-db-1', ['POSTGRES_PASSWORD']);
    await waitForLocalKeycloak();
    const client = await configureLocalKeycloak(keycloak.KC_BOOTSTRAP_ADMIN_PASSWORD, clientId, port,
        saved.HRM_ADMIN_SUBJECT || bootstrap.HRM_ADMIN_SUBJECT);

    const settings = {
        ...client,
        OIDC_ISSUER_URL: issuer,
        DATABASE_URL: 'postgresql://noah_portal:' + encodeURIComponent(postgres.POSTGRES_PASSWORD)
            + '@127.0.0.1:5433/noah_portal',
    };
    writeFileSync(credentialFile, Object.entries({
        ...settings, ...keycloak, PORTAL_DB_PASSWORD: postgres.POSTGRES_PASSWORD,
    }).map(([key, value]) => key + '=' + value).join('\n') + '\n', { mode: 0o600 });
    return settings;
}

