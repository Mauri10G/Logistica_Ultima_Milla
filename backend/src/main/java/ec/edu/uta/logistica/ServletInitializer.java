package ec.edu.uta.logistica;

import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

/**
 * Punto de entrada cuando el backend se despliega como WAR en un Apache Tomcat 11 externo.
 * Tomcat no llama al main, llama a esta clase. Con el JAR de siempre no se usa.
 */
public class ServletInitializer extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder application) {
        return application.sources(LogisticaApplication.class);
    }
}
