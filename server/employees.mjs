export function normalizeEmployee(input) {
    const { employeeNumber, displayName, department, keycloakUserId } = input ?? {};
    const fields = [employeeNumber, displayName, department, keycloakUserId];
    if (fields.some((field) => typeof field !== 'string' || !field.trim())) return null;

    const number = employeeNumber.trim().toUpperCase();
    const name = displayName.trim();
    const unit = department.trim();
    const subject = keycloakUserId.trim();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(number)
            || name.length > 100 || unit.length > 100 || subject.length > 255) return null;

    return { number, name, unit, subject };
}

export async function insertEmployee(database, issuer, { number, name, unit, subject }) {
    await database.query(
        `INSERT INTO employees (employee_number, display_name, department, oidc_issuer, oidc_subject)
         VALUES ($1, $2, $3, $4, $5)`,
        [number, name, unit, issuer, subject]
    );
}
