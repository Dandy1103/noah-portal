package com.noah.portal;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@Component
final class KeycloakAccounts {
    private final PortalSettings settings;
    private final RestClient http;
    private static final String PROVIDER = "Keycloak account management is unavailable.";

    KeycloakAccounts(PortalSettings settings, RestClient http) {
        this.settings = settings;
        this.http = http;
    }

    Connection connect() {
        if (settings.issuer == null || settings.managementClientId.isBlank() || settings.managementClientSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, PROVIDER);
        }
        var path = settings.issuer.getPath();
        if (!path.matches(".*/realms/[^/]+")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, PROVIDER);
        }

        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", settings.managementClientId);
        form.add("client_secret", settings.managementClientSecret);
        try {
            var token = http.post().uri(URI.create(settings.issuer + "/protocol/openid-connect/token"))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(JsonNode.class);
            if (token == null || !token.path("access_token").isTextual()) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, PROVIDER);
            }
            var endpoint = UriComponentsBuilder.fromUri(settings.issuer)
                    .replacePath(path.replaceFirst("/realms/([^/]+)$", "/admin/realms/$1/users"))
                    .build().toUri();
            return new Connection(endpoint, token.path("access_token").textValue());
        } catch (RestClientResponseException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, PROVIDER);
        }
    }

    final class Connection {
        private final URI users;
        private final String token;

        private Connection(URI users, String token) {
            this.users = users;
            this.token = token;
        }

        String create(String username, Employees.Profile profile, String password) {
            try {
                var response = http.post().uri(users).headers(h -> h.setBearerAuth(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("username", username,
                                "firstName", profile.firstName(), "lastName", profile.lastName(),
                                "email", profile.email(), "enabled", true,
                                "credentials", List.of(Map.of("type", "password", "value", password, "temporary", true))))
                        .retrieve().toBodilessEntity();
                var location = response.getHeaders().getLocation();
                String subject = location == null ? "" : location.getPath().replaceFirst(".*/", "");
                if (!subject.matches("[a-zA-Z0-9-]{1,255}")) {
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, PROVIDER);
                }
                return subject;
            } catch (RestClientResponseException error) {
                throw map(error);
            }
        }

        void update(String subject, Map<String, Object> attributes) {
            try {
                http.put().uri(userUri(subject)).headers(h -> h.setBearerAuth(token))
                        .contentType(MediaType.APPLICATION_JSON).body(attributes).retrieve().toBodilessEntity();
            } catch (RestClientResponseException error) {
                throw map(error);
            }
        }

        void remove(String subject) {
            try {
                http.delete().uri(userUri(subject)).headers(h -> h.setBearerAuth(token)).retrieve().toBodilessEntity();
            } catch (RestClientResponseException error) {
                if (error.getStatusCode().value() != 404) throw map(error);
            }
        }

        private URI userUri(String subject) {
            return UriComponentsBuilder.fromUri(users).pathSegment(subject).build().toUri();
        }

        private ResponseStatusException map(RestClientResponseException error) {
            return switch (error.getStatusCode().value()) {
                case 400 -> new ResponseStatusException(HttpStatus.BAD_REQUEST);
                case 404 -> new ResponseStatusException(HttpStatus.NOT_FOUND);
                case 409 -> new ResponseStatusException(HttpStatus.CONFLICT);
                default -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, PROVIDER);
            };
        }
    }
}
