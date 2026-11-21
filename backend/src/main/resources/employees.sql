CREATE TABLE IF NOT EXISTS employees (
    employee_number TEXT PRIMARY KEY CHECK (employee_number ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
    display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
    department TEXT NOT NULL CHECK (length(btrim(department)) > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    oidc_issuer TEXT NOT NULL CHECK (length(btrim(oidc_issuer)) > 0),
    oidc_subject TEXT NOT NULL CHECK (length(btrim(oidc_subject)) > 0),
    UNIQUE (oidc_issuer, oidc_subject)
);
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS managed_account BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT;
