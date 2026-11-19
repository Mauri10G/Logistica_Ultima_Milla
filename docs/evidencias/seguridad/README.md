# Reporte de seguridad

Responsable: Robert Paredes. Pruebas de seguridad del sistema: dependencias vulnerables, análisis dinámico de la API con
OWASP ZAP y validación de entradas. Cómo repetirlas: [`tests/security/README.md`](../../../tests/security/README.md).

## Resumen

| Prueba | Fecha | Resultado | Hallazgos altos | Hallazgos medios |
|---|---|---|---|---|
| ZAP baseline (raíz del backend, sin token) | 2026-11-19 | 67 reglas pasan | 0 | 0 |
| ZAP API (todas las operaciones de lectura, con token STAFF) | 2026-11-19 | 119 reglas pasan | 0 | 0 |
| `npm audit` de la web, dependencias de producción | 2026-11-19 | 0 vulnerabilidades | 0 | 0 |
| `npm audit` de la web, incluidas las de desarrollo | 2026-11-19 | 18 moderadas, todas en la cadena de Jest | 0 | 18 (solo desarrollo) |
| Validación de campos contra la API (63 casos) | 2026-11-19 | 58 responden como se espera | 0 | 1 |
| OWASP Dependency-Check del backend | pendiente | necesita la API key de NVD | — | — |

Contexto de las pruebas: backend en `http://localhost:8080` con `SEGURIDAD_HABILITADA=true` (login con JWT y cabeceras de
seguridad ya agregadas por Joseph), PostGIS 16 en Docker, OWASP ZAP `stable` en Docker.

## 1. Análisis dinámico con OWASP ZAP

Dos pasadas pasivas (solo observan las respuestas, no atacan), con `tests/security/zap.sh`:

1. **Baseline:** la raíz del backend sin token, como la vería alguien sin sesión.
2. **API:** importa la documentación OpenAPI (`/v3/api-docs`) y recorre las operaciones de lectura con el token de `staff`.
   Con la seguridad encendida, un escaneo sin token solo vería respuestas 401; con el token, ZAP revisa las respuestas
   reales de cada endpoint.

Reportes: [`zap-baseline-2026-11-19.html`](zap-baseline-2026-11-19.html) y [`zap-api-2026-11-19.html`](zap-api-2026-11-19.html).

| Alerta | Riesgo | Dónde | Evaluación |
|---|---|---|---|
| Cross-Origin-Resource-Policy Header Missing or Invalid | Bajo | 7 respuestas de la API (por ejemplo `GET /api/zonas`, `GET /api/servidor/hora`) | Falta la cabecera `Cross-Origin-Resource-Policy`. El backend ya manda `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy` y `Cache-Control: no-store`. Mejora opcional: agregar `Cross-Origin-Resource-Policy: same-site` |
| Non-Storable Content | Informativo | Respuestas de la API | Es lo esperado: la API responde `Cache-Control: no-store` a propósito |
| A Client Error response code was returned | Informativo | Peticiones con datos de ejemplo de OpenAPI | Los 400, 404 y 409 son las validaciones del backend funcionando, no un fallo |

Lo que ZAP confirma que está bien: cabeceras anti-clickjacking y `nosniff`, CSP presente, sin versión del servidor ni
`X-Powered-By`, sin mensajes de depuración ni trazas en los errores, sin información sensible en URLs y CORS sin
configuraciones abiertas.

### Incidente durante la prueba (corregido)

En la primera ejecución de la pasada de API, ZAP llamó también a las operaciones `PUT`, `PATCH` y `DELETE` de la
documentación con sus datos de ejemplo, y modificó la base local: el repartidor 10 quedó con nombre "John Doe",
capacidad 10, no disponible y desactivado. Ningún otro dato cambió (se revisaron repartidores, zonas, clientes,
usuarios, pedidos, rutas e historial).

- Se restauró el repartidor 10 a sus valores originales ("Carlos Salazar (R010)", creado por el generador de datos).
- `zap.sh` ahora le pasa a ZAP una copia de la documentación con **solo las operaciones de lectura** y el login.
- Se repitió el escaneo comparando una huella de la base antes y después: **la base quedó idéntica**.

Lección para el informe: el modo "seguro" de `zap-api-scan` (`-S`) evita los ataques, pero no evita que se ejecuten las
operaciones de escritura documentadas. Nunca correrlo contra una base con datos que importen.

## 2. Dependencias vulnerables

### Web (`npm audit`)

| Alcance | Resultado |
|---|---|
| Producción (lo que llega al navegador: React, axios, Leaflet, STOMP, lucide-react...) | **0 vulnerabilidades** |
| Desarrollo (Jest y herramientas de prueba) | 18 moderadas |

Las 18 moderadas vienen de dos paquetes que usa Jest 30 por dentro:

| Paquete | Versión instalada | Aviso | Corregido en |
|---|---|---|---|
| `glob` | 10.5.0 y 13.0.7 | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): la cancelación con `AbortSignal` se puede saltar | 14.0.2 |
| `minimatch` | 9.0.9 y 10.2.6 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): posible denegación de servicio con ciertos patrones | 11.0.1 |

Solo se usan al correr las pruebas, con patrones escritos por el equipo, así que el riesgo real es bajo. `npm audit fix`
propone bajar Jest de la versión 30 a la 29, que no conviene. Lo recomendable es actualizar Jest cuando publique una
versión con estas dependencias corregidas. Reportado a Mauricio (dueño de `web/package.json`).

Reportes: [`npm-audit-web-2026-11-19.json`](npm-audit-web-2026-11-19.json) y
[`npm-audit-web-produccion-2026-11-19.json`](npm-audit-web-produccion-2026-11-19.json).

### Backend (OWASP Dependency-Check)

Pendiente: necesita la API key de NVD de Robert. Sin ella, la primera descarga de la base de vulnerabilidades tarda horas.
El build falla si alguna dependencia tiene CVSS de 7 o más (`failBuildOnCVSS` en el `pom.xml`).

## 3. Validación de entradas

63 casos límite enviados a la API con la seguridad encendida (obligatorios, longitudes, formatos, rangos, fechas,
geometrías de zona, transiciones de estado, 401 y 403). 58 respondieron como se esperaba. Hallazgos reportados:

- [#32](https://github.com/Mauri10G/Logistica_Ultima_Milla/issues/32) (backend, Joseph): el teléfono y el nombre aceptan
  cualquier texto (`"abc"`, `"12345"`) y la fecha de entrega no tiene máximo.
- [#33](https://github.com/Mauri10G/Logistica_Ultima_Milla/issues/33) (web, Mauricio): los formularios no limitan la
  longitud de los campos ni validan el teléfono.

## 4. Pendiente

- Dependency-Check del backend con la API key de NVD.
- Repetir ZAP y Dependency-Check después de las correcciones de #32 y #33 (`bash tests/security/zap.sh despues`) y
  agregar la comparación a este reporte.
