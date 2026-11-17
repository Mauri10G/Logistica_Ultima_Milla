# Imagen del backend del Sistema de Gestion de Entregas y Rutas.
# Etapa base: descarga dependencias con Maven y JDK 21.
FROM eclipse-temurin:21-jdk AS base
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src/ src/

# Etapa test: la usa Jenkins con  docker build --target test  para correr las pruebas unitarias.
FROM base AS test
RUN ./mvnw -B test

# Etapa build: compila el JAR ejecutable.
FROM base AS build
RUN ./mvnw -B -q -DskipTests package

# Imagen final: solo el JRE y el JAR, sin codigo fuente ni Maven.
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 1001 logistica
COPY --from=build /app/target/*.jar /app/app.jar
USER logistica
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
