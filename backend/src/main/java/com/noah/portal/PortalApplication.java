package com.noah.portal;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.AbstractServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
public class PortalApplication {
    public static void main(String[] args) {
        var application = new SpringApplication(PortalApplication.class);
        if (args.length == 0 || !("migrate".equals(args[0]) || "link".equals(args[0]))) {
            application.run(args);
            return;
        }
        application.setWebApplicationType(WebApplicationType.NONE);
        try (var context = application.run()) {
            var employees = context.getBean(Employees.class);
            if ("link".equals(args[0])) {
                if (args.length != 5) {
                    throw new IllegalArgumentException("link <employee number> <name> <department> <Keycloak user ID>");
                }
                var settings = context.getBean(PortalSettings.class);
                if (settings.issuer == null) throw new IllegalStateException("OIDC_ISSUER_URL is required.");
                employees.link(settings.issuer.toString(),
                        new Employees.LinkedEmployee(args[1], args[2], args[3], args[4]));
                System.out.println("Employee linked.");
            } else {
                employees.requireDatabase();
                System.out.println("Employee table is ready.");
            }
        }
    }

    @Bean
    RestClient restClient(RestClient.Builder builder) {
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        var requests = new JdkClientHttpRequestFactory(client);
        requests.setReadTimeout(Duration.ofSeconds(8));
        return builder.requestFactory(requests).build();
    }

    @Bean
    WebServerFactoryCustomizer<AbstractServletWebServerFactory> sessionCookie(PortalSettings settings) {
        return factory -> {
            var cookie = factory.getSession().getCookie();
            cookie.setName(settings.cookieName());
            cookie.setSecure(settings.secure());
            cookie.setHttpOnly(true);
            cookie.setPath("/");
            cookie.setMaxAge(Duration.ofHours(8));
        };
    }

    @Bean
    WebMvcConfigurer assets(PortalSettings settings) {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                var origins = new String[] {
                        "http://localhost:*",
                        "http://127.0.0.1:*",
                        "https://*.dandy-cheng.com"
                };
                registry.addMapping("/api/session").allowedOriginPatterns(origins).allowedMethods("GET").allowCredentials(true);
                registry.addMapping("/api/me/employee").allowedOriginPatterns(origins).allowedMethods("GET").allowCredentials(true);
            }

            @Override
            public void addResourceHandlers(ResourceHandlerRegistry registry) {
                registry.addResourceHandler("/**")
                        .addResourceLocations(settings.portalDirectory.toUri().toString().replaceFirst("/?$", "/"));
            }
        };
    }
}
