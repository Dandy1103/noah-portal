package com.noah.portal;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@RestController
final class PortalController {
    private static final Logger LOG = LoggerFactory.getLogger(PortalController.class);
    private static final String ACCOUNTS = "/api/hrm/accounts";
    private final PortalSettings settings;
    private final PortalIdentity identity;
    private final Employees employees;

    PortalController(PortalSettings settings, PortalIdentity identity, Employees employees) {
        this.settings = settings;
        this.identity = identity;
        this.employees = employees;
    }

    @ModelAttribute
    void headers(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("X-Content-Type-Options", "nosniff");
    }

    @GetMapping("/healthz")
    ResponseEntity<Void> health() {
        return Files.isRegularFile(settings.portalDirectory.resolve("index.html"))
                ? ResponseEntity.ok().build() : ResponseEntity.status(503).build();
    }

    @GetMapping({"/auth/login", "/auth/hrm-dev/login"})
    ResponseEntity<Void> login(HttpServletRequest request, @RequestParam(name = "next", required = false) String next,
            @RequestParam(name = "reauth", defaultValue = "false") boolean reauthenticate) {
        boolean hrmDev = request.getServletPath().equals("/auth/hrm-dev/login");
        if (hrmDev && !settings.hrmDevEnabled) return ResponseEntity.notFound().build();
        var returnTo = LoginDestination.resolve(next, hrmDev);
        if (!settings.ssoConfigured()) return signInError(hrmDev, "unavailable", returnTo);
        try {
            return redirect(identity.begin(request, hrmDev, returnTo, reauthenticate));
        } catch (RuntimeException error) {
            LOG.warn("OIDC login could not start: {}", error.getClass().getSimpleName());
            return signInError(hrmDev, "unavailable", returnTo);
        }
    }

    @GetMapping({PortalSettings.CALLBACK, PortalSettings.HRM_CALLBACK})
    ResponseEntity<Void> callback(HttpServletRequest request,
            @RequestParam(required = false) String code, @RequestParam(required = false) String state) {
        boolean hrmDev = request.getServletPath().equals(PortalSettings.HRM_CALLBACK);
        if (hrmDev && !settings.hrmDevEnabled) return ResponseEntity.notFound().build();
        if (!hrmDev && request.getQueryString() == null) {
            return redirect(identity.user(request) == null ? LoginDestination.start("/") : "/");
        }
        String returnTo = identity.pendingDestination(request, hrmDev, state);
        if (!settings.ssoConfigured()) return signInError(hrmDev, "unavailable", returnTo);
        try {
            return redirect(identity.complete(request, hrmDev, code, state));
        } catch (RuntimeException error) {
            LOG.warn("OIDC callback failed: {}", error.getClass().getSimpleName());
            return signInError(hrmDev, "signin", returnTo);
        }
    }

    @GetMapping("/auth/change-password")
    ResponseEntity<Void> changePassword(HttpServletRequest request, HttpServletResponse response,
            @RequestParam(name = "next", required = false) String next) {
        var destination = LoginDestination.resolve(next, false);
        var user = activeUser(request, response);
        if (user == null) return redirect("/auth/login?next="
                + org.springframework.web.util.UriUtils.encode(destination, java.nio.charset.StandardCharsets.UTF_8));
        try {
            return redirect(identity.changePassword(request, destination, user));
        } catch (RuntimeException error) {
            LOG.warn("Keycloak password action could not start: {}", error.getClass().getSimpleName());
            return signInError(user.hrmDev(), "unavailable", destination);
        }
    }

    @PostMapping("/auth/logout")
    ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        requireLogoutOrigin(request);
        String refreshToken = identity.logoutToken(request);
        if (request.getSession(false) != null) endSession(request, response);
        try {
            identity.logoutFromKeycloak(refreshToken);
        } catch (RuntimeException error) {
            LOG.warn("Keycloak logout failed: {}", error.getClass().getSimpleName());
        }
        return ResponseEntity.status(HttpStatus.SEE_OTHER).location(URI.create("/auth/login?reauth=true")).build();
    }

    @GetMapping({"/", "/index.html", "/login", "/profile", "/permissions"})
    ResponseEntity<?> portal(HttpServletRequest request, HttpServletResponse response) {
        boolean isLogin = request.getServletPath().equals("/login");
        var user = activeUser(request, response);
        if (isLogin && user != null) return redirect("/");
        if (user == null && !(isLogin && (request.getParameter("error") != null
                || "1".equals(request.getParameter("signedOut"))))) {
            return redirect(LoginDestination.start(isLogin ? LoginDestination.resolve(request.getParameter("next"), false)
                    : requestedDestination(request)));
        }
        return index(settings.portalDirectory);
    }

    @GetMapping({"/hrm", "/hrm/{*path}"})
    ResponseEntity<?> hrm(HttpServletRequest request, HttpServletResponse response,
            @PathVariable(required = false) String path) throws IOException {
        if (settings.hrmDirectory == null) return ResponseEntity.notFound().build();
        String relative = path == null ? "" : path.replaceFirst("^/", "");
        if (!relative.isEmpty() && !relative.equals("index.html")) {
            var file = settings.hrmDirectory.resolve(relative).normalize();
            if (!file.startsWith(settings.hrmDirectory)) return ResponseEntity.notFound().build();
            if (Files.isRegularFile(file) && file.toRealPath().startsWith(settings.hrmDirectory.toRealPath())) {
                return ResponseEntity.ok().contentType(MediaTypeFactory.getMediaType(file.getFileName().toString())
                        .orElse(MediaType.APPLICATION_OCTET_STREAM)).body(new FileSystemResource(file));
            }
            if (file.getFileName().toString().contains(".")) return ResponseEntity.notFound().build();
        }
        if (activeUser(request, response) == null) return redirect(LoginDestination.start(requestedDestination(request)));
        if (request.getServletPath().equals("/hrm")) {
            return redirect("/hrm/" + (request.getQueryString() == null ? "" : "?" + request.getQueryString()));
        }
        return index(settings.hrmDirectory);
    }

    @GetMapping("/api/session")
    Map<String, Object> session(HttpServletRequest request, HttpServletResponse response) {
        var user = requireUser(request, response);
        String hrmUrl = settings.hrmUrl;
        if (hrmUrl.isEmpty() && settings.hrmDirectory != null
                && Files.isRegularFile(settings.hrmDirectory.resolve("index.html"))) {
            hrmUrl = "/hrm/";
        }
        return Map.of("displayName", user.displayName(), "hrmAvailable", !hrmUrl.isEmpty(), "hrmUrl", hrmUrl);
    }

    @GetMapping("/api/me/employee")
    Map<String, Object> employee(HttpServletRequest request, HttpServletResponse response) {
        return employees.profile(requireUser(request, response));
    }

    @GetMapping("/api/hrm/access")
    ResponseEntity<Void> access(HttpServletRequest request, HttpServletResponse response) {
        requireHrmAdmin(request, response);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/hrm/employees")
    ResponseEntity<Map<String, String>> link(HttpServletRequest request, HttpServletResponse response,
            @RequestBody Employees.LinkedEmployee input) {
        var user = requireHrmMutation(request, response);
        return created(employees.link(user.issuer(), input));
    }

    @GetMapping(ACCOUNTS)
    Employees.AccountPage accounts(HttpServletRequest request, HttpServletResponse response,
            @RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "0") int offset) {
        return employees.list(requireHrmAdmin(request, response), q, offset);
    }

    @PostMapping(ACCOUNTS)
    ResponseEntity<Map<String, String>> create(HttpServletRequest request, HttpServletResponse response,
            @RequestBody Employees.NewAccount input) {
        return created(employees.create(requireHrmMutation(request, response), input));
    }

    @PatchMapping(ACCOUNTS + "/{number}")
    ResponseEntity<Void> update(HttpServletRequest request, HttpServletResponse response,
            @PathVariable String number, @RequestBody Employees.AccountUpdate input) {
        employees.update(requireHrmMutation(request, response), number, input);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping(ACCOUNTS + "/{number}")
    ResponseEntity<Void> disable(HttpServletRequest request, HttpServletResponse response, @PathVariable String number) {
        employees.changeStatus(requireHrmMutation(request, response), number, false);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(ACCOUNTS + "/{number}/restore")
    ResponseEntity<Void> restore(HttpServletRequest request, HttpServletResponse response, @PathVariable String number) {
        employees.changeStatus(requireHrmMutation(request, response), number, true);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<Void> duplicate() {
        return ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @ExceptionHandler({DataAccessException.class, TransactionException.class, RestClientException.class})
    ResponseEntity<Void> unavailable(RuntimeException error) {
        LOG.warn("Portal service request failed: {}", error.getClass().getSimpleName());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Void> status(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).build();
    }

    private PortalIdentity.User requireHrmMutation(HttpServletRequest request, HttpServletResponse response) {
        var user = requireHrmAdmin(request, response);
        requireOrigin(request, user.hrmDev() ? PortalSettings.HRM_DEV_ORIGIN : settings.originValue());
        return user;
    }

    private PortalIdentity.User requireHrmAdmin(HttpServletRequest request, HttpServletResponse response) {
        var user = requireUser(request, response);
        if (settings.hrmAdminSubject.isBlank() || !settings.hrmAdminSubject.equals(user.subject())
                || settings.issuer == null || !settings.issuer.toString().equals(user.issuer())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return user;
    }

    private PortalIdentity.User requireUser(HttpServletRequest request, HttpServletResponse response) {
        var user = activeUser(request, response);
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return user;
    }

    private PortalIdentity.User activeUser(HttpServletRequest request, HttpServletResponse response) {
        var user = identity.user(request);
        if (user != null && employees.isInactive(user)) {
            endSession(request, response);
            return null;
        }
        return user;
    }

    private void endSession(HttpServletRequest request, HttpServletResponse response) {
        request.getSession(false).invalidate();
        var cookie = ResponseCookie.from(settings.cookieName(), "").path("/").httpOnly(true).secure(settings.secure())
                .sameSite("Lax").maxAge(Duration.ZERO).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private static void requireOrigin(HttpServletRequest request, String expected) {
        if (!expected.equals(request.getHeader("Origin"))) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }

    private void requireLogoutOrigin(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (settings.originValue().equals(origin) || siblingOrigin(origin)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }

    private boolean siblingOrigin(String origin) {
        if (origin == null || origin.isBlank()) return false;
        URI uri;
        try {
            uri = URI.create(origin);
        } catch (IllegalArgumentException error) {
            return false;
        }
        String host = uri.getHost();
        if (host == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null
                || uri.getRawFragment() != null || (uri.getPath() != null && !uri.getPath().isEmpty())) {
            return false;
        }
        if ("localhost".equalsIgnoreCase(settings.origin.getHost())) {
            return "http".equalsIgnoreCase(uri.getScheme())
                    && ("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host));
        }
        return "https".equalsIgnoreCase(uri.getScheme())
                && host.toLowerCase(Locale.ROOT).endsWith(".dandy-cheng.com");
    }

    private static ResponseEntity<?> index(Path directory) {
        var file = directory.resolve("index.html");
        if (!Files.isRegularFile(file)) return ResponseEntity.status(503).build();
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).header("Referrer-Policy", "same-origin")
                .body(new FileSystemResource(file));
    }

    private static ResponseEntity<Map<String, String>> created(String employeeNumber) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("employeeNumber", employeeNumber));
    }

    private static String requestedDestination(HttpServletRequest request) {
        var query = request.getQueryString();
        return LoginDestination.resolve(request.getRequestURI() + (query == null ? "" : "?" + query), false);
    }

    private static ResponseEntity<Void> signInError(boolean hrmDev, String code, String destination) {
        return redirect((hrmDev ? "/?authError=" : "/login?error=") + code + LoginDestination.keep(destination));
    }

    private static ResponseEntity<Void> redirect(String path) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(path)).build();
    }
}
