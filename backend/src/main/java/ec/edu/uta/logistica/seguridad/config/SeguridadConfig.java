package ec.edu.uta.logistica.seguridad.config;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import ec.edu.uta.logistica.seguridad.entity.Rol;
import ec.edu.uta.logistica.seguridad.service.TokenService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * Spring Security con JWT firmados con HS256 (clave en {@code logistica.seguridad.jwt.secreto}).
 *
 * <ul>
 *   <li>API sin estado: no hay sesion HTTP ni cookies, cada peticion trae {@code Authorization: Bearer}. Por eso
 *       CSRF no aplica y se desactiva.</li>
 *   <li>{@code logistica.seguridad.habilitada=false}: todo abierto (no se lee el token); solo quedan CORS y las
 *       cabeceras de seguridad.</li>
 *   <li>Reglas por rol aqui; las reglas "solo lo suyo" de un COURIER, en {@code ControlAcceso}.</li>
 * </ul>
 * Contrato completo: docs/api-auth.md.
 */
@Configuration
@EnableWebSecurity
public class SeguridadConfig {

    static final String CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
    static final String CSP_SWAGGER = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            + "script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    static final String PERMISSIONS_POLICY = "geolocation=(), camera=(), microphone=(), payment=()";

    private static final String STAFF = Rol.STAFF.name();
    private static final String COURIER = Rol.COURIER.name();
    private static final String RUTA_LOGIN = "/api/auth/login";
    private static final String[] RUTAS_SWAGGER = {"/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**"};

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public JwtEncoder jwtEncoder(SeguridadProperties propiedades) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(clave(propiedades)));
    }

    @Bean
    public JwtDecoder jwtDecoder(SeguridadProperties propiedades) {
        NimbusJwtDecoder decodificador = NimbusJwtDecoder.withSecretKey(clave(propiedades))
                .macAlgorithm(MacAlgorithm.HS256).build();
        // valida firma, vencimiento (exp/nbf) y que el emisor sea este backend
        decodificador.setJwtValidator(JwtValidators.createDefaultWithIssuer(propiedades.jwt().emisor()));
        return decodificador;
    }

    /** Claim {@code rol} = STAFF/COURIER -> autoridad ROLE_STAFF/ROLE_COURIER; el nombre es el claim {@code sub}. */
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter autoridades = new JwtGrantedAuthoritiesConverter();
        autoridades.setAuthoritiesClaimName(TokenService.CLAIM_ROL);
        autoridades.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter conversor = new JwtAuthenticationConverter();
        conversor.setJwtGrantedAuthoritiesConverter(autoridades);
        return conversor;
    }

    @Bean
    public SecurityFilterChain cadenaDeSeguridad(HttpSecurity http, SeguridadProperties propiedades,
                                                 RespuestaErrorSeguridad errores,
                                                 JwtAuthenticationConverter conversor) {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .headers(this::cabeceras)
                .exceptionHandling(e -> e.authenticationEntryPoint(errores).accessDeniedHandler(errores));

        if (!propiedades.habilitada()) {
            http.authorizeHttpRequests(a -> a.anyRequest().permitAll());
            return http.build();
        }

        http.authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, RUTA_LOGIN).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/servidor/hora").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers(RUTAS_SWAGGER).permitAll()
                        // el handshake es publico; el token se valida en el CONNECT de STOMP
                        .requestMatchers("/ws", "/ws/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        // lo que puede hacer un COURIER (y ControlAcceso verifica que sea suyo)
                        .requestMatchers(HttpMethod.GET, "/api/repartidores/*/ruta-actual").hasAnyRole(STAFF, COURIER)
                        .requestMatchers(HttpMethod.GET, "/api/pedidos/*").hasAnyRole(STAFF, COURIER)
                        .requestMatchers(HttpMethod.PATCH, "/api/pedidos/*/estado").hasAnyRole(STAFF, COURIER)
                        .requestMatchers(HttpMethod.GET, "/api/rutas/*").hasAnyRole(STAFF, COURIER)
                        // todo lo demas de la API: zonas, repartidores, pedidos, rutas, ajustes, seguimiento
                        .requestMatchers("/api/**").hasRole(STAFF)
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.jwtAuthenticationConverter(conversor))
                        .bearerTokenResolver(resolverIgnorandoLogin())
                        .authenticationEntryPoint(errores)
                        .accessDeniedHandler(errores));
        return http.build();
    }

    /**
     * El login no lee el token: si el cliente manda uno vencido junto con usuario y clave, el login debe funcionar
     * igual en vez de responder 401 por el token viejo.
     */
    private static BearerTokenResolver resolverIgnorandoLogin() {
        DefaultBearerTokenResolver porDefecto = new DefaultBearerTokenResolver();
        RequestMatcher login = PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, RUTA_LOGIN);
        return request -> login.matches(request) ? null : porDefecto.resolve(request);
    }

    /**
     * Cabeceras de seguridad (hallazgos tipicos de ZAP baseline). X-Content-Type-Options, X-Frame-Options y
     * Cache-Control ya las pone Spring Security; aqui se agregan CSP, Referrer-Policy y Permissions-Policy.
     * Swagger UI necesita cargar sus propios scripts y estilos, por eso tiene una CSP aparte.
     */
    private void cabeceras(HeadersConfigurer<HttpSecurity> h) {
        RequestMatcher swagger = new OrRequestMatcher(
                Arrays.stream(RUTAS_SWAGGER).map(PathPatternRequestMatcher.withDefaults()::matcher)
                        .toArray(RequestMatcher[]::new));
        h.contentTypeOptions(Customizer.withDefaults())
                .frameOptions(f -> f.deny())
                .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy", PERMISSIONS_POLICY))
                .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(swagger,
                        new StaticHeadersWriter("Content-Security-Policy", CSP_SWAGGER)))
                .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(new NegatedRequestMatcher(swagger),
                        new StaticHeadersWriter("Content-Security-Policy", CSP_API)));
    }

    /** Clave HMAC-SHA256. Falla al arrancar si no hay secreto o si es demasiado corto para HS256. */
    static SecretKey clave(SeguridadProperties propiedades) {
        String secreto = propiedades.jwt().secreto();
        if (secreto == null || secreto.getBytes(StandardCharsets.UTF_8).length < SeguridadProperties.LARGO_MINIMO_SECRETO) {
            throw new IllegalStateException("logistica.seguridad.jwt.secreto debe tener al menos "
                    + SeguridadProperties.LARGO_MINIMO_SECRETO + " caracteres (HS256)");
        }
        return new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }
}
