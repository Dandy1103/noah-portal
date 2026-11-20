import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import session from 'express-session';
import * as oidc from 'openid-client';

const app = express();
const browserDirectory = resolve('dist/noah-portal/browser');
const indexFile = resolve(browserDirectory, 'index.html');
const port = process.env.PORT || 3000;
const publicUrl = new URL(process.env.APP_ORIGIN || 'http://localhost:3000');
const callbackPath = '/auth/callback';
const callbackUrl = new URL(callbackPath, publicUrl);
const secure = publicUrl.protocol === 'https:';
const cookieName = secure ? '__Host-noah.sid' : 'noah.sid';
const tenant = process.env.ENTRA_TENANT_ID?.toLowerCase();
const clientId = process.env.ENTRA_CLIENT_ID;
const clientSecret = process.env.ENTRA_CLIENT_SECRET;
const employeeLoginDomain = process.env.ENTRA_EMPLOYEE_LOGIN_DOMAIN?.trim().toLowerCase();
const sessionSecret = process.env.SESSION_SECRET;
const ssoConfigured = Boolean(tenant && clientId && clientSecret && sessionSecret);
const tenantIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const employeeNumberPattern = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
const signInLifetime = 10 * 60 * 1000;
let configurationPromise;

const localHttp = publicUrl.protocol === 'http:' && publicUrl.hostname === 'localhost';
if (!secure && (!localHttp || (ssoConfigured && process.env.NODE_ENV === 'production'))) {
    throw new Error('APP_ORIGIN must use HTTPS outside localhost.');
}
if (tenant && !tenantIdPattern.test(tenant)) {
    throw new Error('ENTRA_TENANT_ID must be the directory tenant UUID.');
}
if (employeeLoginDomain && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(employeeLoginDomain)) {
    throw new Error('ENTRA_EMPLOYEE_LOGIN_DOMAIN must be a domain name.');
}
if (sessionSecret && Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('SESSION_SECRET must be at least 32 bytes.');
}

function oidcConfiguration() {
    configurationPromise ??= oidc.discovery(
        new URL(`https://login.microsoftonline.com/${tenant}/v2.0`),
        clientId,
        undefined,
        oidc.ClientSecretPost(clientSecret),
        { execute: [oidc.enableNonRepudiationChecks] }
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

async function startSignIn(request, response, loginHint) {
    if (!ssoConfigured) return response.redirect('/login?error=unavailable');
    if (request.session.user) return response.redirect('/');

    try {
        const config = await oidcConfiguration();
        const verifier = oidc.randomPKCECodeVerifier();
        const state = oidc.randomState();
        const nonce = oidc.randomNonce();
        const authorization = oidc.buildAuthorizationUrl(config, {
            redirect_uri: callbackUrl.href,
            scope: 'openid profile',
            code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
            code_challenge_method: 'S256',
            state,
            nonce,
            ...(loginHint && { login_hint: loginHint })
        });
        request.session.signIn = { verifier, state, nonce, expiresAt: Date.now() + signInLifetime };
        request.session.save((error) => {
            if (error) return response.redirect('/login?error=unavailable');
            response.redirect(loginHint ? 303 : 302, authorization.href);
        });
    } catch {
        response.redirect('/login?error=unavailable');
    }
}

app.get('/auth/login', (request, response) => startSignIn(request, response));

app.post('/auth/login', express.urlencoded({ extended: false, limit: '1kb', parameterLimit: 1 }), (request, response) => {
    if (request.get('Origin') !== publicUrl.origin) return response.sendStatus(403);
    if (!employeeLoginDomain) return response.redirect(303, '/login?error=employee-unavailable');

    const employeeNumber = typeof request.body?.employeeNumber === 'string' ? request.body.employeeNumber.trim() : '';
    if (!employeeNumberPattern.test(employeeNumber)) return response.redirect(303, '/login?error=employee-number');
    return startSignIn(request, response, `${employeeNumber}@${employeeLoginDomain}`);
});

app.get(callbackPath, async (request, response) => {
    if (Object.keys(request.query).length === 0) {
        return response.redirect(request.session?.user ? '/' : '/login');
    }

    if (!ssoConfigured) return response.redirect('/login?error=unavailable');

    const signIn = request.session.signIn;
    if (!signIn || Date.now() >= signIn.expiresAt || request.query.state !== signIn.state) {
        return response.redirect('/login?error=signin');
    }

    try {
        delete request.session.signIn;
        await new Promise((done, fail) => request.session.save((error) => error ? fail(error) : done()));
        const callback = new URL(callbackUrl);
        callback.search = new URL(request.originalUrl, publicUrl).search;
        const tokens = await oidc.authorizationCodeGrant(await oidcConfiguration(), callback, {
            expectedState: signIn.state,
            expectedNonce: signIn.nonce,
            pkceCodeVerifier: signIn.verifier
        });
        const claims = tokens.claims();
        if (!claims?.sub) return response.redirect('/login?error=signin');

        request.session.regenerate((error) => {
            if (error) return response.redirect('/login?error=unavailable');
            request.session.user = { displayName: claims.name || '公司帳號' };
            request.session.save((saveError) => {
                response.redirect(saveError ? '/login?error=unavailable' : '/');
            });
        });
    } catch {
        response.redirect('/login?error=signin');
    }
});

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
    response.json(request.session.user);
});

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
    console.log(`Noah Portal listening on port ${port} (Entra SSO ${ssoConfigured ? 'configured' : 'pending'}).`);
});
