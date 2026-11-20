import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { insertEmployee, normalizeEmployee } from './employees.mjs';

const [command, number, name, department, subject] = process.argv.slice(2);
const databaseUrl = process.env.DATABASE_URL;
const issuer = process.env.OIDC_ISSUER_URL;

if (!databaseUrl) throw new Error('Set DATABASE_URL before using the employee database.');
if (command !== 'migrate' && command !== 'add') {
    throw new Error('Use migrate or add <employee number> <name> <department> <Keycloak user ID>.');
}

const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
await client.connect();

try {
    if (command === 'migrate') {
        await client.query(await readFile(new URL('./employees.sql', import.meta.url), 'utf8'));
        console.log('Employee table is ready.');
    } else {
        const employee = normalizeEmployee({
            employeeNumber: number, displayName: name, department, keycloakUserId: subject
        });
        if (!employee || !issuer) {
            throw new Error('Provide an employee number, name, department, Keycloak user ID and OIDC_ISSUER_URL.');
        }
        await insertEmployee(client, issuer, employee);
        console.log('Employee added.');
    }
} finally {
    await client.end();
}
