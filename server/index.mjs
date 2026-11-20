import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import session from 'express-session';
import * as oidc from 'openid-client';
import pg from 'pg';
import { insertEmployee, normalizeEmployee } from './employees.mjs';

const app = express();
const browserDirectory = resolve('dist/noah-portal/browser');
const indexFile = resolve(browserDirectory, 'index.html');
const hrmDirectory = process.env.HRM_BROWSER_DIRECTORY && resolve(process.env.HRM_BROWSER_DIRECTORY);
const hrmIndexFile = hrmDirectory && resolve(hrmDirectory, 'index.html');
const hrmAdminSubject = process.env.HRM_ADMIN_SUBJECT;
const port = process.env.PORT || 3000;
const publicUrl = new URL(process.env.APP_ORIGIN || 'http://localhost:3000');
const callbackPath = '/auth/callback';
const callbackUrl = new URL(callbackPath, publicUrl);
const hrmDevEnabled = process.env.HRM_DEV_SSO_ENABLED === 'true';
const hrmDevCallbackPath = '/auth/hrm-dev/callback';
const hrmDevCallbackUrl = new URL(hrmDevCallbackPath, 'http://localhost:4201');
const secure = publicUrl.protocol === 'https:';
const cookieName = secure ? '__Host-noah.sid' : 'noah.sid';
const issuerUrl = process.env.OIDC_ISSUER_URL && new URL(process.env.OIDC_ISSUER_URL);
const clientId = process.env.OIDC_CLIENT_ID;
const clientSecret = process.env.OIDC_CLIENT_SECRET;
const sessionSecret = process.env.SESSION_SECRET;
const databaseUrl = process.env.DATABASE_URL;
const employeeDatabase = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 }) : null;
const ssoConfigured = Boolean(issuerUrl && clientId && clientSecret && sessionSecret);
const signInLifetime = 10 * 60 * 1000;
let configurationPromise;

employeeDatabase?.on('error', (error) => {
    console.error('Employee database connection error:', error.code);
});

const localHttp = publicUrl.protocol === 'http:' && publicUrl.hostname === 'localhost';
if (!secure && (!localHttp || (ssoConfigured && process.env.NODE_ENV === 'production'))) {
    throw new Error('APP_ORIGIN must use HTTPS outside localhost.');
}
const localIssuer = issuerUrl?.protocol === 'http:' && issuerUrl.hostname === 'localhost'
    && localHttp && process.env.NODE_ENV !== 'production';
if (issuerUrl && issuerUrl.protocol !== 'https:' && !localIssuer) {
    throw new Error('OIDC_ISSUER_URL must use HTTPS outside local development.');
}
if (sessionSecret && Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('SESSION_SECRET must be at least 32 bytes.');
}

function oidcConfiguration() {
    const execute = [oidc.enableNonRepudiationChecks];
    if (localIssuer) execute.push(oidc.allowInsecureRequests);
    configurationPromise ??= oidc.discovery(
        issuerUrl,
        clientId,
        undefined,
        oidc.ClientSecretBasic(clientSecret),
        { execute }
    ).catch((error) => {
        configurationPromise = undefined;
        throw error;
    });
    return configurationPromise;
}

app.disable('x-powered-by');
if (secure) app.set('trust proxy', 1);

app.get('/healthz', (_request, response) => {
    response.sendStatus(existsSync(indexFile) ? 200 : 503);
});

app.use(['/auth', '/api'], (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
});
app.use((_request, response, next) => {
    response.set('Referrer-Policy', 'no-referrer');
    response.set('X-Content-Type-Options', 'nosniff');
    next();
});

if (ssoConfigured) {
    app.use(session({
        name: cookieName,
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, secure, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
    }));
}

function signInError(response, hrmDev, error) {
    response.redirect(hrmDev ? `/?authError=${error}` : `/login?error=${error}`);
}

async function startSignIn(request, response, hrmDev) {
    if (hrmDev && !hrmDevEnabled) return response.sendStatus(404);
    if (!ssoConfigured) return signInError(response, hrmDev, 'unavailable');
    const returnTo = !hrmDev && hrmDirectory && request.query.next === 'hrm' ? '/hrm/' : '/';
    if (request.session.user && Boolean(request.session.hrmDev) === hrmDev) return response.redirect(returnTo);

    try {
        const config = await oidcConfiguration();
        const verifier = oidc.randomPKCECodeVerifier();
        const state = oidc.randomState();
        const nonce = oidc.randomNonce();
        const authorization = oidc.buildAuthorizationUrl(config, {
            redirect_uri: (hrmDev ? hrmDevCallbackUrl : callbackUrl).href,
            scope: 'openid profile',
            code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
            code_challenge_method: 'S256',
            state,
            nonce
        });
        request.session.signIn = { verifier, state, nonce, returnTo, hrmDev, expiresAt: Date.now() + signInLifetime };
        request.session.save((error) => {
            if (error) return signInError(response, hrmDev, 'unavailable');
            response.redirect(authorization.href);
        });
    } catch {
        signInError(response, hrmDev, 'unavailable');
    }
}

app.get('/auth/login', (request, response) => startSignIn(request, response, false));
app.get('/auth/hrm-dev/login', (request, response) => startSignIn(request, response, true));

async function finishSignIn(request, response, hrmDev) {
    if (hrmDev && !hrmDevEnabled) return response.sendStatus(404);
    if (!hrmDev && Object.keys(request.query).length === 0) {
        return response.redirect(request.session?.user ? '/' : '/login');
    }

    if (!ssoConfigured) return signInError(response, hrmDev, 'unavailable');

    const signIn = request.session.signIn;
    if (!signIn || Boolean(signIn.hrmDev) !== hrmDev || Date.now() >= signIn.expiresAt || request.query.state !== signIn.state) {
        return signInError(response, hrmDev, 'signin');
    }

    try {
        delete request.session.signIn;
        await new Promise((done, fail) => request.session.save((error) => error ? fail(error) : done()));
        const callback = new URL(hrmDev ? hrmDevCallbackUrl : callbackUrl);
        callback.search = new URL(request.originalUrl, publicUrl).search;
        const tokens = await oidc.authorizationCodeGrant(await oidcConfiguration(), callback, {
            expectedState: signIn.state,
            expectedNonce: signIn.nonce,
            pkceCodeVerifier: signIn.verifier
        });
        const claims = tokens.claims();
        if (!claims?.sub || !claims.iss) return signInError(response, hrmDev, 'signin');

        request.session.regenerate((error) => {
            if (error) return signInError(response, hrmDev, 'unavailable');
            request.session.hrmDev = hrmDev;
            request.session.user = {
                displayName: claims.name || claims.preferred_username || '員工',
                issuer: claims.iss,
                subject: claims.sub
            };
            request.session.save((saveError) => {
                if (saveError) return signInError(response, hrmDev, 'unavailable');
                response.redirect(signIn.returnTo ?? '/');
            });
        });
    } catch {
        signInError(response, hrmDev, 'signin');
    }
}

app.get(callbackPath, (request, response) => finishSignIn(request, response, false));
app.get(hrmDevCallbackPath, (request, response) => finishSignIn(request, response, true));

app.post('/auth/logout', (request, response) => {
    if (request.get('Origin') !== publicUrl.origin) return response.sendStatus(403);
    if (!request.session?.user) return response.redirect(303, '/login');

    request.session.destroy((error) => {
        if (error) return response.sendStatus(503);
        response.clearCookie(cookieName, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
        response.redirect(303, '/login');
    });
});

app.get('/api/session', (request, response) => {
    if (!request.session?.user) return response.sendStatus(401);
    response.json({
        displayName: request.session.user.displayName,
        hrmAvailable: Boolean(hrmIndexFile && existsSync(hrmIndexFile))
    });
});

function requireHrmAdmin(request, response, next) {
    const user = request.session?.user;
    if (!user) return response.sendStatus(401);
    if (!hrmAdminSubject || user.subject !== hrmAdminSubject || user.issuer !== issuerUrl?.href) {
        return response.sendStatus(403);
    }
    next();
}

app.get('/api/hrm/access', requireHrmAdmin, (_request, response) => response.sendStatus(204));

app.post('/api/hrm/employees', requireHrmAdmin, express.json({ limit: '4kb' }), async (request, response) => {
    const expectedOrigin = request.session.hrmDev ? hrmDevCallbackUrl.origin : publicUrl.origin;
    if (request.get('Origin') !== expectedOrigin) return response.sendStatus(403);
    if (!employeeDatabase) return response.sendStatus(503);
    const employee = normalizeEmployee(request.body);
    if (!employee) return response.sendStatus(400);

    try {
        await insertEmployee(employeeDatabase, request.session.user.issuer, employee);
        response.status(201).json({ employeeNumber: employee.number });
    } catch (error) {
        if (error.code === '23505') return response.sendStatus(409);
        console.error('Unable to add employee:', error.code);
        response.sendStatus(503);
    }
});

app.get('/api/me/employee', async (request, response) => {
    const user = request.session?.user;
    if (!user) return response.sendStatus(401);
    if (!employeeDatabase) return response.sendStatus(503);

    try {
        const result = await employeeDatabase.query(
            `SELECT employee_number AS "employeeNumber", display_name AS "displayName", department, status
             FROM employees
             WHERE oidc_issuer = $1 AND oidc_subject = $2`,
            [user.issuer, user.subject]
        );
        const employee = result.rows[0];
        if (!employee) return response.sendStatus(404);
        response.json(employee);
    } catch (error) {
        console.error('Unable to read employee profile:', error.code);
        response.sendStatus(503);
    }
});

if (hrmDirectory) {
    app.get(['/hrm/', '/hrm/index.html'], (request, response) => {
        response.set('Cache-Control', 'no-store');
        if (!request.session?.user) return response.redirect('/auth/login?next=hrm');
        if (!existsSync(hrmIndexFile)) return response.sendStatus(503);
        response.set('Referrer-Policy', 'same-origin');
        response.sendFile(hrmIndexFile);
    });
    app.use('/hrm', express.static(hrmDirectory, { index: false, redirect: false }));
}

app.get(['/', '/index.html', '/login'], (request, response) => {
    response.set('Cache-Control', 'no-store');
    const signedIn = Boolean(request.session?.user);
    if (request.path === '/login' && signedIn) return response.redirect('/');
    if (request.path !== '/login' && !signedIn) return response.redirect('/login');
    if (!existsSync(indexFile)) return response.sendStatus(503);
    // Keep Origin on same-origin form submissions and limit referrers to the Portal.
    response.set('Referrer-Policy', 'same-origin');
    response.sendFile(indexFile);
});
app.use(express.static(browserDirectory, { index: false, redirect: false }));
app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Noah Portal listening on port ${port} (SSO ${ssoConfigured ? 'configured' : 'pending'}).`);
});
