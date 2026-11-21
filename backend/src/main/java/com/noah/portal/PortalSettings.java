package com.noah.portal;

import java.net.URI;
import java.nio.file.Path;
import java.util.Locale;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
final class PortalSettings {
    static final String CALLBACK = "/auth/callback";
    static final String HRM_CALLBACK = "/auth/hrm-dev/callback";
    static final String HRM_DEV_ORIGIN = "http://localhost:4201";
    static final String HRM_DEV_REDIRECT = HRM_DEV_ORIGIN + HRM_CALLBACK;

    final URI origin;
    final URI issuer;
    final String clientId;
    final String clientSecret;
    final String databaseUrl;
    final String hrmAdminSubject;
    final boolean hrmDevEnabled;
    final String managementClientId;
    final String managementClientSecret;
    final Path portalDirectory;
    final Path hrmDirectory;
    final String hrmUrl;

    PortalSettings(Environment environment) {
        origin = URI.create(environment.getProperty("APP_ORIGIN", "http://localhost:3000"));
        String issuerValue = environment.getProperty("OIDC_ISSUER_URL", "").strip();
        issuer = issuerValue.isBlank() ? null : URI.create(issuerValue);
        clientId = environment.getProperty("OIDC_CLIENT_ID", "");
        clientSecret = environment.getProperty("OIDC_CLIENT_SECRET", "");
        databaseUrl = environment.getProperty("DATABASE_URL", "");
        hrmAdminSubject = environment.getProperty("HRM_ADMIN_SUBJECT", "");
        hrmDevEnabled = environment.getProperty("HRM_DEV_SSO_ENABLED", Boolean.class, false);
        managementClientId = environment.getProperty("HRM_KEYCLOAK_CLIENT_ID", "");
        managementClientSecret = environment.getProperty("HRM_KEYCLOAK_CLIENT_SECRET", "");
        portalDirectory = Path.of(environment.getProperty("PORTAL_BROWSER_DIRECTORY", "dist/noah-portal/browser"))
                .toAbsolutePath().normalize();
        var hrmPath = environment.getProperty("HRM_BROWSER_DIRECTORY", "");
        hrmDirectory = hrmPath.isBlank() ? null : Path.of(hrmPath).toAbsolutePath().normalize();

        boolean local = "http".equals(origin.getScheme()) && "localhost".equalsIgnoreCase(origin.getHost());
        if (origin.getHost() == null || origin.getRawUserInfo() != null || origin.getRawFragment() != null
                || origin.getRawQuery() != null || !origin.getPath().matches("/?") || (!secure() && !local)) {
            throw new IllegalArgumentException("APP_ORIGIN must be an HTTPS origin or a local localhost origin.");
        }
        var hrmUrlValue = environment.getProperty("HRM_URL", local ? HRM_DEV_ORIGIN + "/" : "").strip();
        hrmUrl = hrmUrlValue.isEmpty() ? "" : checkedHrmUrl(hrmUrlValue, local);
        if (issuer != null && (issuer.getHost() == null || issuer.getRawUserInfo() != null
                || issuer.getRawQuery() != null || issuer.getRawFragment() != null
                || (!"https".equals(issuer.getScheme())
                && !(local && "http".equals(issuer.getScheme()) && "localhost".equalsIgnoreCase(issuer.getHost()))))) {
            throw new IllegalArgumentException("OIDC_ISSUER_URL must use HTTPS outside local development.");
        }
    }

    private static String checkedHrmUrl(String value, boolean local) {
        var url = URI.create(value);
        boolean allowedScheme = "https".equalsIgnoreCase(url.getScheme())
                || (local && "http".equalsIgnoreCase(url.getScheme()) && "localhost".equalsIgnoreCase(url.getHost()));
        if (!allowedScheme || url.getHost() == null || url.getRawUserInfo() != null
                || url.getRawQuery() != null || url.getRawFragment() != null) {
            throw new IllegalArgumentException("HRM_URL must be an HTTPS URL or a local localhost URL.");
        }
        return url.toASCIIString();
    }

    boolean secure() {
        return "https".equals(origin.getScheme());
    }

    String cookieName() {
        return secure() ? "__Host-noah.sid" : "noah.sid";
    }

    String originValue() {
        return origin.getScheme() + "://" + origin.getAuthority().toLowerCase(Locale.ROOT);
    }

    boolean ssoConfigured() {
        return issuer != null && !clientId.isBlank() && !clientSecret.isBlank();
    }
}
