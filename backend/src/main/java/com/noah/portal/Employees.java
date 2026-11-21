package com.noah.portal;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Component
final class Employees {
    private static final Logger LOG = LoggerFactory.getLogger(Employees.class);
    private static final Pattern NUMBER = Pattern.compile("[A-Z0-9][A-Z0-9_-]{0,31}");
    private static final Pattern EMAIL = Pattern.compile("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");
    private static final Pattern HAN = Pattern.compile("\\p{IsHan}");
    private static final int PAGE_SIZE = 30;

    private final HikariDataSource source;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final KeycloakAccounts keycloak;

    record LinkedEmployee(String employeeNumber, String displayName, String department, String keycloakUserId) {}
    record Profile(String firstName, String lastName, String department, String email) {
        Profile validated() {
            String address = text(email, 254);
            if (!EMAIL.matcher(address).matches()) throw badRequest();
            return new Profile(text(firstName, 48), text(lastName, 48), text(department, 100), address);
        }

        String displayName() {
            return HAN.matcher(lastName + firstName).find() ? lastName + firstName : firstName + " " + lastName;
        }
    }
    record NewAccount(String employeeNumber, String nationalId, String firstName, String lastName, String department,
                      String email, String initialPassword) {}
    record AccountUpdate(String firstName, String lastName, String department, String email, String nationalId) {}
    record AccountPage(List<Map<String, Object>> accounts, boolean hasMore, int pageSize) {}
    private record ManagedAccount(String subject, boolean managed, String email) {}

    Employees(PortalSettings settings, KeycloakAccounts keycloak) {
        this.keycloak = keycloak;
        if (settings.databaseUrl.isBlank()) {
            source = null;
            jdbc = null;
            tx = null;
            return;
        }
        source = new HikariDataSource(databaseConfig(settings.databaseUrl));
        try {
            new ResourceDatabasePopulator(new ClassPathResource("employees.sql")).execute(source);
        } catch (RuntimeException error) {
            source.close();
            throw error;
        }
        jdbc = new JdbcTemplate(source);
        tx = new TransactionTemplate(new DataSourceTransactionManager(source));
    }

    void requireDatabase() {
        if (jdbc == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @PreDestroy
    void close() {
        if (source != null) source.close();
    }

    boolean isInactive(PortalIdentity.User user) {
        return jdbc != null && exists("""
                SELECT 1 FROM employees WHERE oidc_issuer=? AND oidc_subject=? AND status='inactive'
                """, user.issuer(), user.subject());
    }

    Map<String, Object> profile(PortalIdentity.User user) {
        requireDatabase();
        return jdbc.queryForList("""
                SELECT employee_number AS "employeeNumber", display_name AS "displayName", department, status
                FROM employees WHERE oidc_issuer=? AND oidc_subject=?
                """, user.issuer(), user.subject()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    String link(String issuer, LinkedEmployee employee) {
        requireDatabase();
        String number = normalizeNumber(employee.employeeNumber());
        jdbc.update("""
                INSERT INTO employees (employee_number, display_name, department, oidc_issuer, oidc_subject)
                VALUES (?, ?, ?, ?, ?)
                """, number, text(employee.displayName(), 100), text(employee.department(), 100), issuer,
                text(employee.keycloakUserId(), 255));
        return number;
    }

    AccountPage list(PortalIdentity.User user, String query, int offset) {
        requireDatabase();
        if (query.length() > 100 || offset < 0 || offset > 99999999) throw badRequest();
        String term = query.strip();
        var rows = jdbc.queryForList("""
                SELECT employee_number AS "employeeNumber", display_name AS "displayName", department,
                    first_name AS "firstName", last_name AS "lastName", email, status, managed_account AS managed,
                    (managed_account AND oidc_subject <> ?) AS editable
                FROM employees WHERE oidc_issuer = ? AND (
                    strpos(lower(employee_number), lower(?)) > 0 OR strpos(lower(display_name), lower(?)) > 0
                    OR strpos(lower(department), lower(?)) > 0 OR strpos(lower(coalesce(email, '')), lower(?)) > 0
                )
                ORDER BY employee_number LIMIT ? OFFSET ?
                """, user.subject(), user.issuer(), term, term, term, term, PAGE_SIZE + 1, offset);
        return new AccountPage(rows.subList(0, Math.min(PAGE_SIZE, rows.size())), rows.size() > PAGE_SIZE, PAGE_SIZE);
    }

    String create(PortalIdentity.User user, NewAccount input) {
        requireDatabase();
        String number = normalizeNumber(input.employeeNumber());
        String username = NationalId.username(input.nationalId());
        var profile = new Profile(input.firstName(), input.lastName(), input.department(), input.email()).validated();
        String password = input.initialPassword();
        if (password == null || password.length() < 12 || password.length() > 128 || password.isBlank()) {
            throw badRequest();
        }

        var connection = keycloak.connect();
        String[] subject = new String[1];
        try {
            tx.executeWithoutResult(status -> {
                jdbc.query("SELECT pg_advisory_xact_lock(hashtext(?))", (rs, row) -> 1, number);
                if (exists("SELECT 1 FROM employees WHERE employee_number=?", number)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT);
                }
                subject[0] = connection.create(username, profile, password);
                jdbc.update("""
                        INSERT INTO employees (employee_number, display_name, department, oidc_issuer, oidc_subject,
                                               managed_account, first_name, last_name, email)
                        VALUES (?, ?, ?, ?, ?, true, ?, ?, ?)
                        """, number, profile.displayName(), profile.department(), user.issuer(), subject[0],
                        profile.firstName(), profile.lastName(), profile.email());
            });
        } catch (RuntimeException error) {
            if (subject[0] == null) throw error;
            try {
                if (exists("SELECT 1 FROM employees WHERE employee_number=? AND oidc_subject=?", number, subject[0])) {
                    return number;
                }
                connection.remove(subject[0]);
            } catch (RuntimeException cleanup) {
                LOG.error("Could not reconcile HRM account creation after a database error.");
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
            }
            throw error;
        }
        return number;
    }

    void update(PortalIdentity.User user, String number, AccountUpdate input) {
        requireDatabase();
        Profile profile = new Profile(input.firstName(), input.lastName(), input.department(), input.email()).validated();
        String username = input.nationalId() == null || input.nationalId().isBlank()
                ? null : NationalId.username(input.nationalId());
        tx.executeWithoutResult(status -> {
            var account = managed(user, number);
            jdbc.update("""
                    UPDATE employees SET first_name=?, last_name=?, email=?, display_name=?, department=?
                    WHERE employee_number=?
                    """, profile.firstName(), profile.lastName(), profile.email(), profile.displayName(),
                    profile.department(), number);
            Map<String, Object> attributes = new LinkedHashMap<>();
            attributes.put("firstName", profile.firstName());
            attributes.put("lastName", profile.lastName());
            attributes.put("email", profile.email());
            if (username != null) attributes.put("username", username);
            if (account.email == null || !account.email.equalsIgnoreCase(profile.email())) {
                attributes.put("emailVerified", false);
            }
            keycloak.connect().update(account.subject, attributes);
        });
    }

    void changeStatus(PortalIdentity.User user, String number, boolean enabled) {
        requireDatabase();
        tx.executeWithoutResult(status -> {
            var account = managed(user, number);
            jdbc.update("UPDATE employees SET status=? WHERE employee_number=?", enabled ? "active" : "inactive", number);
            keycloak.connect().update(account.subject, Map.of("enabled", enabled));
        });
    }

    private ManagedAccount managed(PortalIdentity.User user, String number) {
        if (!NUMBER.matcher(number).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var result = jdbc.query("""
                SELECT oidc_subject, managed_account, email FROM employees
                WHERE employee_number=? AND oidc_issuer=? FOR UPDATE
                """, (rs, row) -> new ManagedAccount(rs.getString(1), rs.getBoolean(2), rs.getString(3)),
                number, user.issuer());
        if (result.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var account = result.getFirst();
        if (!account.managed || Objects.equals(account.subject, user.subject())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return account;
    }

    private boolean exists(String sql, Object... args) {
        return !jdbc.queryForList(sql, args).isEmpty();
    }

    private static HikariConfig databaseConfig(String value) {
        var url = URI.create(value);
        if (!("postgresql".equals(url.getScheme()) || "postgres".equals(url.getScheme())) || url.getHost() == null) {
            throw new IllegalArgumentException("DATABASE_URL must be a PostgreSQL URL.");
        }
        var config = new HikariConfig();
        String host = url.getHost();
        String port = url.getPort() == -1 ? "" : ":" + url.getPort();
        String query = url.getRawQuery() == null ? "" : "?" + url.getRawQuery();
        config.setJdbcUrl("jdbc:postgresql://" + host + port + url.getRawPath() + query);
        if (url.getRawUserInfo() != null) {
            var parts = url.getRawUserInfo().split(":", 2);
            config.setUsername(decode(parts[0]));
            if (parts.length == 2) config.setPassword(decode(parts[1]));
        }
        config.setMaximumPoolSize(5);
        config.setConnectionTimeout(5000);
        return config;
    }

    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    private static String normalizeNumber(String value) {
        String number = text(value, 32).toUpperCase(Locale.ROOT);
        if (!NUMBER.matcher(number).matches()) throw badRequest();
        return number;
    }

    private static String text(String value, int max) {
        if (value == null || value.isBlank() || value.strip().length() > max) throw badRequest();
        return value.strip();
    }

    private static ResponseStatusException badRequest() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST);
    }
}
