import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, delimiter, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { demoLogin } from '../keycloak/setup-local-hrm.mjs';
import { startLocalIdentity } from '../keycloak/shared-local-identity.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const npm = process.env.npm_execpath;
const envFile = join(root, '.env.keycloak');
const children = new Set();

function run(command, args, options = {}) {
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
    if (result.error || result.status !== 0) throw new Error(command + ' 執行失敗，請查看上方訊息。');
}

function dockerCommand() {
    const candidates = windows ? [
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
        process.env.ProgramFiles && join(process.env.ProgramFiles, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
    ] : [];
    const installed = candidates.find((path) => path && existsSync(path));
    if (installed) process.env.PATH = dirname(installed) + delimiter + process.env.PATH;
    const docker = installed || 'docker';
    const result = spawnSync(docker, ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore', timeout: 12000 });
    if (result.error || result.status !== 0) throw new Error('請先安裝並開啟 Docker Desktop，等 Engine running 後再執行。');
    return docker;
}

function installFrontend(directory) {
    if (!existsSync(join(directory, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'))) {
        run(process.execPath, [npm, 'ci'], { cwd: directory });
    }
}

function launch(command, args, env = process.env, cwd = root) {
    const child = spawn(command, args, { cwd, stdio: 'inherit', env });
    children.add(child);
    const exit = new Promise((done) => {
        child.once('error', () => done(1));
        child.once('exit', (code) => done(code ?? 0));
    }).then((code) => {
        children.delete(child);
        return code;
    });
    return exit;
}

function stopChildren() {
    for (const child of children) {
        if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
        if (windows) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        else child.kill('SIGTERM');
    }
}

async function listening(port, host) {
    return new Promise((done) => {
        const server = createServer();
        server.once('error', () => done(true));
        server.listen(port, host, () => server.close(() => done(false)));
    });
}

async function waitForApp(url, signal) {
    for (let attempt = 0; attempt < 90; attempt++) {
        const response = await fetch(url, {
            headers: { accept: 'text/html' },
            signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
        }).catch(() => null);
        if (response?.ok) return;
        await sleep(1000, undefined, { signal });
    }
    throw new Error('服務啟動逾時，請查看 Maven 或 Angular 的訊息。');
}

async function main() {
    if (process.argv[2]) throw new Error('請在要開發的專案目錄執行 npm start。');
    const frontend = 4200;
    for (const [wanted, host] of [[frontend, 'localhost']]) {
        if (await listening(wanted, host)) throw new Error(wanted + ' 已被占用。請先停止舊的開發程序。');
    }
    const externalFile = join(root, '.env.local');
    const external = existsSync(externalFile) ? parseEnv(readFileSync(externalFile, 'utf8')) : {};
    let configuration;
    if (external.OIDC_ISSUER_URL) {
        for (const name of ['OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET']) {
            if (!external[name]) throw new Error('.env.local 缺少 ' + name + '。');
        }
        configuration = {
            HRM_ADMIN_SUBJECT: '',
            HRM_KEYCLOAK_CLIENT_ID: '',
            HRM_KEYCLOAK_CLIENT_SECRET: '',
            HRM_DEV_SSO_ENABLED: 'false',
            ...external,
        };
    } else {
        const docker = dockerCommand();
        run(process.execPath, ['keycloak/create-local-env.mjs']);
        configuration = await startLocalIdentity(docker, root, parseEnv(readFileSync(envFile, 'utf8')), 'noah-portal', frontend, 'keycloak/compose.yaml');
    }

    if (!existsSync(join(root, 'dist', 'noah-portal', 'browser', 'index.html'))) {
        installFrontend(root);
        run(process.execPath, [npm, 'run', 'build']);
    }
    installFrontend(root);

    const env = {
        ...process.env,
        ...configuration,
        CORE_URL: configuration.CORE_URL || process.env.CORE_URL || 'https://noah-platform.dandy-cheng.com',
        APP_ORIGIN: 'http://localhost:' + frontend,
    };
    const processExit = launch(process.execPath, ['node_modules/@angular/cli/bin/ng.js',
        'serve', '--port', '4200'], env);

    const firstExit = processExit;
    const readyUrls = [new URL('/api/apps/healthz', env.CORE_URL).href,
        'http://localhost:4200/assets/images/logo.png'];
    const startup = new AbortController();
    const ready = await Promise.race([
        Promise.all(readyUrls.map((url) => waitForApp(url, startup.signal))),
        firstExit.then(() => null),
    ]).finally(() => startup.abort());
    if (!ready) throw new Error('服務提前停止，請查看 Core 或 Angular 的訊息。');
    console.log('開啟 http://localhost:' + frontend + '/');
    if (!external.OIDC_ISSUER_URL) console.log('本機測試帳號 ' + demoLogin.toUpperCase() + '，初始密碼在 .env.shared-keycloak 的 KEYCLOAK_DEMO_PASSWORD。');
    process.exitCode = await firstExit;
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stopChildren);
try {
    await main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    stopChildren();
}
