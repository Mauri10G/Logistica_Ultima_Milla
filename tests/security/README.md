# Pruebas de seguridad

Los reportes se guardan en [`reports/`](reports/) (la carpeta se versiona vacía; los archivos generados están en
`.gitignore`). Para el informe, la evidencia se copia a [`docs/evidencias/seguridad/`](../../docs/evidencias/seguridad/),
donde está el **reporte de seguridad** con los hallazgos y su corrección.

## 1. Dependencias vulnerables — OWASP Dependency-Check (Maven)

```bash
cd backend
./mvnw org.owasp:dependency-check-maven:check -Dnvd.api.key=TU_API_KEY
```

Para no escribir la key en la línea de comandos (queda en el historial), guardarla una vez en una variable de entorno:

```bash
read -rs NVD_API_KEY && export NVD_API_KEY      # Git Bash: la pide sin mostrarla
./mvnw org.owasp:dependency-check-maven:check -Dnvd.api.key="$NVD_API_KEY"
```

- La API key de NVD se pasa **como `-Dnvd.api.key=...`** (no con otro nombre). Se solicita gratis en
  https://nvd.nist.gov/developers/request-an-api-key. Sin key, la primera descarga de la base NVD es muy lenta.
- La primera ejecución descarga la base de vulnerabilidades (varios m## 2. Análisis dinámico — OWASP ZAP (Docker)

Con el backend corriendo en `http://localhost:8080`, desde la **raíz del repositorio** en Git Bash:

```bash
bash tests/security/zap.sh antes       # el sufijo identifica la ejecución: antes / despues de las correcciones
BASE_URL=http://servidor:8080 bash tests/security/zap.sh
```

El script hace login como `staff` (o `API_USUARIO` / `API_CLAVE`) y ejecuta dos pasadas **pasivas** (solo observan las
respuestas, no atacan):

| Pasada | Qué revisa | Reportes |
|---|---|---|
| Baseline | La raíz del backend sin token: cabeceras, Swagger, páginas públicas | `zap-baseline-<sufijo>.html/.json` |
| API | Importa la documentación OpenAPI y recorre las operaciones con el token | `zap-api-<sufijo>.html/.json` |

- `host.docker.internal` es el `localhost` de tu PC visto desde el contenedor (Docker Desktop).
- Con la seguridad encendida, un escaneo sin token solo ve respuestas 401: por eso la pasada de API manda el token.
- **Cuidado:** al importar OpenAPI, ZAP ejecuta **cada** operación documentada con datos de ejemplo, también `PUT`,
  `PATCH` y `DELETE`, aunque esté en modo seguro (`-S`), y eso modifica la base. El script le pasa a ZAP una copia de
  la documentación con solo las operaciones de lectura y el login. No usar `zap-api-scan.py` directo contra la API.
- Hacerlo solo contra el sistema propio (localhost).

## 3. Dependencias de la web — npm audit

```bash
cd web
npm audit --omit=dev                                         # solo lo que llega al navegador
npm audit --json > ../tests/security/reports/npm-audit-web.json
```

## Hallazgos y estado

Ver el reporte en [`docs/evidencias/seguridad/`](../../docs/evidencias/seguridad/). Resumen al 19 de noviembre:
ZAP sin hallazgos altos ni medios, 0 vulnerabilidades en las dependencias de producción de la web, 18 moderadas solo en
herramientas de prueba, y en el backend una sola dependencia vulnerable: DOMPurify dentro de Swagger UI (#43).
