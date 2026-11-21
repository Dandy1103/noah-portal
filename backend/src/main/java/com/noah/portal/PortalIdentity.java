package com.noah.portal;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenDecoderFactory;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrations;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Component
final class PortalIdentity {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String LOGIN_ATTEMPT = "loginAttempt";
    private static final int MAX_LOGIN_ATTEMPTS = 8;
    private static final String LOGOUT_TOKEN = "logoutToken";
    private static final String USER = "portalUser";
    private final PortalSettings settings;
    private final RestClient http;
    private final OidcIdTokenDecoderFactory idTokens = new OidcIdTokenDecoderFactory();
    private volatile ClientRegistration registration;

    record User(String displayName, String issuer, String subject, boolean hrmDev) {}
    private record LoginAttempt(String verifier, String state, String nonce, String returnTo,
                                boolean hrmDev, String passwordSubject, Instant expires) {}

    PortalIdentity(PortalSettings settings, RestClient http) {
        this.settings = settings;
        this.http = http;
    }

    User user(HttpServletRequest request) {
        var session = request.getSession(false);
        return session == null ? null : (User) session.getAttribute(USER);
    }

    String pendingDestination(HttpServletRequest request, boolean hrmDev, String state) {
        var session = request.getSession(false);
        if (session == null || state == null) return "/";
        synchronized (session) {
            var attempt = attempts(session).get(state);
            return attempt != null && attempt.hrmDev == hrmDev && Instant.now().isBefore(attempt.expires)
                    ? attempt.returnTo : "/";
        }
    }

    String begin(HttpServletRequest request, boolean hrmDev, String returnTo, boolean reauthenticate) {
        return begin(request, hrmDev, returnTo, null, reauthenticate);
    }

    String changePassword(HttpServletRequest request, String returnTo, User user) {
        return begin(request, user.hrmDev, returnTo, user.subject, true);
    }

    private String begin(HttpServletRequest request, boolean hrmDev, String returnTo, String passwordSubject,
            boolean reauthenticate) {
        User user = user(request);
        if (!reauthenticate && user != null && user.hrmDev == hrmDev) return returnTo;

        var attempt = new LoginAttempt(random(), random(), random(), returnTo, hrmDev,
                passwordSubject, Instant.now().plusSeconds(600));
        var provider = registration().getProviderDetails();
        var authorization = UriComponentsBuilder.fromUriString(provider.getAuthorizationUri())
                .queryParam("response_type", "code")
                .queryParam("client_id", settings.clientId)
                .queryParam("redirect_uri", redirectUri(hrmDev))
                .queryParam("scope", "openid profile")
                .queryParam("state", attempt.state)
                .queryParam("nonce", attempt.nonce)
                .queryParam("code_challenge", challenge(attempt.verifier))
                .queryParam("code_challenge_method", "S256");
        if (passwordSubject != null) authorization.queryParam("kc_action", "UPDATE_PASSWORD");
        if (reauthenticate) authorization.queryParam("prompt", "login");
        String location = authorization.encode().build().toUriString();
        var session = request.getSession(true);
        synchronized (session) {
            var pending = attempts(session);
            pending.values().removeIf(item -> !Instant.now().isBefore(item.expires));
            if (pending.size() >= MAX_LOGIN_ATTEMPTS) pending.remove(pending.keySet().iterator().next());
            pending.put(attempt.state, attempt);
        }
        return location;
    }

    String complete(HttpServletRequest request, boolean hrmDev, String code, String state) {
        HttpSession session = request.getSession(false);
        if (session == null || code == null || code.isBlank() || code.length() > 4096) {
            throw new IllegalArgumentException("Missing authorization response.");
        }

        LoginAttempt attempt;
        synchronized (session) {
            var pending = attempts(session);
            attempt = pending.get(state);
            if (attempt == null || attempt.hrmDev != hrmDev || !Instant.now().isBefore(attempt.expires)
                    || !matches(attempt.state, state)) {
                throw new IllegalArgumentException("Invalid authorization response.");
            }
            pending.remove(state);
        }

        var registration = registration();
        var body = new LinkedMultiValueMap<String, String>();
        body.add("grant_type", "authorization_code");
        body.add("code", code);
        body.add("redirect_uri", redirectUri(hrmDev));
        body.add("code_verifier", attempt.verifier);
        JsonNode tokens = http.post().uri(registration.getProviderDetails().getTokenUri())
                .headers(headers -> headers.setBasicAuth(formEncode(settings.clientId), formEncode(settings.clientSecret)))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(body).retrieve().body(JsonNode.class);
        if (tokens == null || !tokens.path("id_token").isTextual()) {
            throw new IllegalArgumentException("OIDC provider did not return an ID token.");
        }
        var id = idTokens.createDecoder(registration).decode(tokens.path("id_token").textValue());
        if (!matches(attempt.nonce, id.getClaimAsString("nonce")) || id.getSubject() == null || id.getSubject().isBlank()) {
            throw new IllegalArgumentException("Invalid ID token.");
        }

        if (attempt.passwordSubject != null && !attempt.passwordSubject.equals(id.getSubject())) {
            throw new IllegalArgumentException("Password action account changed.");
        }

        synchronized (session) {
            User current = user(request);
            if (current == null || current.hrmDev != hrmDev || !current.subject.equals(id.getSubject())) {
                request.changeSessionId();
            }
            session.setAttribute(LOGOUT_TOKEN, tokens.path("refresh_token").textValue());
            session.setAttribute(USER, new User(firstNonBlank(id.getClaimAsString("name"), "員工"), id.getIssuer().toString(), id.getSubject(), hrmDev));
        }
        return attempt.returnTo;
    }

    String logoutToken(HttpServletRequest request) {
        var session = request.getSession(false);
        return session == null ? null : (String) session.getAttribute(LOGOUT_TOKEN);
    }

    void logoutFromKeycloak(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) return;
        var endpoint = registration().getProviderDetails().getConfigurationMetadata().get("end_session_endpoint");
        if (!(endpoint instanceof String url) || url.isBlank()) return;
        var form = new LinkedMultiValueMap<String, String>();
        form.add("refresh_token", refreshToken);
        http.post().uri(url)
                .headers(headers -> headers.setBasicAuth(formEncode(settings.clientId), formEncode(settings.clientSecret)))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form).retrieve().toBodilessEntity();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, LoginAttempt> attempts(HttpSession session) {
        var pending = (Map<String, LoginAttempt>) session.getAttribute(LOGIN_ATTEMPT);
        if (pending != null) return pending;
        pending = new LinkedHashMap<>();
        session.setAttribute(LOGIN_ATTEMPT, pending);
        return pending;
    }

    private ClientRegistration registration() {
        var current = registration;
        if (current != null) return current;
        synchronized (this) {
            if (registration == null) {
                registration = ClientRegistrations.fromOidcIssuerLocation(settings.issuer.toString())
                        .registrationId("noah-portal").clientId(settings.clientId).clientSecret(settings.clientSecret)
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .redirectUri(redirectUri(false)).scope("openid", "profile").build();
            }
            return registration;
        }
    }

    private String redirectUri(boolean hrmDev) {
        return hrmDev ? PortalSettings.HRM_DEV_REDIRECT : settings.originValue() + PortalSettings.CALLBACK;
    }

    private static String formEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String random() {
        byte[] entropy = new byte[32];
        RANDOM.nextBytes(entropy);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(entropy);
    }

    private static String challenge(String verifier) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private static boolean matches(String expected, String actual) {
        return actual != null && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }

    private static String firstNonBlank(String... options) {
        for (String option : options) {
            if (option != null && !option.isBlank()) return option;
        }
        throw new IllegalArgumentException();
    }
}
