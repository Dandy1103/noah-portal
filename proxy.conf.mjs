const core = process.env.CORE_URL || 'https://noah-platform.dandy-cheng.com';

export default [{ context: ['/auth', '/oauth2', '/login', '/api'], target: core, xfwd: true }];
