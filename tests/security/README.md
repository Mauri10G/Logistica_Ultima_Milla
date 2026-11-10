# Pruebas de seguridad

Los reportes se guardan en [`reports/`](reports/) (la carpeta se versiona vacía; los archivos generados están en
`.gitignore`). Para el informe, copiar la evidencia a `docs/evidencias/`.

## 1. Dependencias vulnerables — OWASP Dependency-Check (Maven)

```bash
cd backend
./mvnw org.owasp:dependency-check-maven:check -Dnvd.api.key=TU_API_KEY
```

- La API key de NVD se pasa **como `-Dnvd.api.key=...`** (no con otro nombre). Se solicita gratis en
  https://nvd.nist.gov/developers/request-an-api-key. Sin key, la primera descarga de la base NVD es muy lenta.
- La primera ejecución descarga la base de vulnerabilidades (varios minutos); las siguientes son incrementales.
- El build falla si hay alguna vulnerabilidad con CVSS ≥ 7 (`failBuildOnCVSS` en el `pom.xml`).
- Reportes: `backend/target/dependency-check-report.html` y `.json` → copiarlos a `tests/security/reports/`.
- Si aparecen CVE en `spring-core`, `log4j` u otras transitivas: subir la versión de Spring Boot en el `pom.xml`
  (hoy 4.1.2) y revisar `./mvnw dependency:tree`.

## 2. Análisis dinámico — OWASP ZAP baseline (Docker)

Con el backend corriendo en `http://localhost:8080` (y opcionalmente la web en `http://localhost:5173`).
Desde la **raíz del repositorio**:

**Git Bash**

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/tests/security/reports:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://host.docker.internal:8080 -r zap-baseline-backend.html -J zap-baseline-backend.json
```

**cmd (Windows)**

```bat
docker run --rm -v "%cd%\tests\security\reports:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:8080 -r zap-baseline-backend.html
```

- `host.docker.internal` es el `localhost` de tu PC visto desde el contenedor (Docker Desktop).
- Para escanear la API usando su documentación OpenAPI (más cobertura de endpoints):

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/tests/security/reports:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py -t http://host.docker.internal:8080/v3/api-docs -f openapi -r zap-api-backend.html
```

- `zap-baseline.py` termina con código distinto de 0 si hay alertas (WARN/FAIL): es normal y se interpreta en el informe.
- Es un escaneo **pasivo**: no ataca. Hacerlo solo contra el sistema propio (localhost).

## Hallazgos esperados en esta base

- Sin autenticación (todavía) y CORS abierto para `localhost` y el emulador: es una decisión del alcance actual.
- Cabeceras de seguridad HTTP no configuradas (CSP, X-Frame-Options...): candidato a mejora.
