import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync,
    readdirSync, renameSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, delimiter, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { demoLogin } from '../keycloak/setup-local-hrm.mjs';
import { startLocalIdentity } from '../keycloak/shared-local-identity.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const npm = process.env.npm_execpath;
const javaCache = join(root, 'tmp', 'java-tools');
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

function hasJava(home) {
    const name = windows ? 'javac.exe' : 'javac';
    const bin = home ? join(home, 'bin', name) : name;
    const result = spawnSync(bin, ['-version'], { encoding: 'utf8', timeout: 6000 });
    return result.status === 0 && /javac 21(?:\.|\s|$)/.test(result.stdout + result.stderr);
}

async function selectJava() {
    if (process.env.JAVA_HOME && hasJava(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
    if (!process.env.JAVA_HOME && hasJava()) return null;
    if (!windows) throw new Error('請安裝 JDK 21，並設定 JAVA_HOME 後再執行。');

    mkdirSync(javaCache, { recursive: true });
    const existing = readdirSync(javaCache, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('jdk-'))
        .map((entry) => join(javaCache, entry.name)).find(hasJava);
    if (existing) return existing;

    const machine = process.env.PROCESSOR_ARCHITEW6432 || process.env.PROCESSOR_ARCHITECTURE || '';
    const arch = /^arm64$/i.test(machine) ? 'aarch64' : 'x64';
    const url = 'https://aka.ms/download-jdk/microsoft-jdk-21-windows-' + arch + '.zip';
    const temp = mkdtempSync(join(javaCache, 'download-'));
    const archive = join(temp, 'jdk.zip');
    console.log('正在下載本機開發用的 JDK 21，第一次啟動可能需要幾分鐘。');
    try {
        const checksum = await fetch(url + '.sha256sum.txt', { signal: AbortSignal.timeout(30000) });
        const expected = checksum.ok && (await checksum.text()).match(/\b[a-f0-9]{64}\b/i)?.[0].toLowerCase();
        if (!expected) throw new Error('無法取得 JDK 的 SHA-256 校驗資料。');
        const response = await fetch(url, { signal: AbortSignal.timeout(300000) });
        if (!response.ok || !response.body) throw new Error('JDK 下載失敗，請稍後再試。');
        await pipeline(Readable.fromWeb(response.body), createWriteStream(archive, { flags: 'wx' }));
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(archive)) hash.update(chunk);
        if (hash.digest('hex') !== expected) throw new Error('JDK 檔案與官方 SHA-256 不符，請重新執行。');
        run('tar.exe', ['-xf', archive, '-C', temp]);
        const home = readdirSync(temp).map((name) => join(temp, name)).find(hasJava);
        if (!home) throw new Error('JDK 解壓縮後找不到 Java 21。');
        const installation = join(javaCache, basename(home));
        if (!hasJava(installation)) renameSync(home, installation);
        return installation;
    } finally {
        rmSync(temp, { recursive: true, force: true });
    }
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
    const port = 3000;
    const frontend = 4200;
    for (const [wanted, host] of [[port, '127.0.0.1'], [frontend, 'localhost']]) {
        if (await listening(wanted, host)) throw new Error(wanted + ' 已被占用。請先停止舊的開發程序。');
    }
    const java = await selectJava();
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
            CORE_URL: 'http://127.0.0.1:8080',
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
        ...(java && { JAVA_HOME: java, PATH: join(java, 'bin') + delimiter + process.env.PATH }),
        MAVEN_USER_HOME: javaCache,
        PORT: String(port),
        APP_ORIGIN: 'http://localhost:' + frontend,
        SERVER_ADDRESS: '127.0.0.1',
        DEBUG: 'false',
    };
    const processes = [windows
        ? launch('cmd.exe', ['/d', '/c', 'mvnw.cmd', '-Dmaven.repo.local=tmp/java-tools/m2', 'spring-boot:run'], env)
        : launch('sh', ['./mvnw', '-Dmaven.repo.local=tmp/java-tools/m2', 'spring-boot:run'], env)];
    processes.push(launch(process.execPath, ['node_modules/@angular/cli/bin/ng.js',
        'serve', '--host', 'localhost', '--port', '4200'], env));

    const firstExit = Promise.race(processes);
    const readyUrls = ['http://localhost:' + port + '/healthz',
        'http://localhost:4200/assets/images/logo.png'];
    const startup = new AbortController();
    const ready = await Promise.race([
        Promise.all(readyUrls.map((url) => waitForApp(url, startup.signal))),
        firstExit.then(() => null),
    ]).finally(() => startup.abort());
    if (!ready) throw new Error('服務提前停止，請查看 Maven 或 Angular 的訊息。');
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
