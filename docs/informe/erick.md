# Informe individual — Aplicación móvil del repartidor y pruebas

- **Integrante**: Erick Alexander López Yantalema
- **Rol**: Aplicación móvil del repartidor (`mobile/`) y sus pruebas (unitarias, widgets, integración lado móvil de `CP-11` y casos de prueba para el Plan PPF).
- **Grupo / Materia**: GPIS, Sexto A, Grupo D.

## 1. Alcance asumido y respeto de propiedad de archivos

Se trabajó exclusivamente sobre la carpeta `mobile/` (incluido `pubspec.yaml` y `AndroidManifest.xml`), la sección móvil de `docs/diseno-sistema.md`, `docs/casos-prueba-mobile-ppf.md`, `docs/evidencias/mobile/` y este informe, sin modificar `backend/`, `web/` ni `tests/`.

## 2. Funcionalidad implementada

El desarrollo se organizó en ramas cortas derivadas de `develop`:

1. **Ruta del día, Google Maps y resiliencia (`feature/mobile-ruta-navegacion`)**:
   - Ordenamiento estricto de paradas según `ordenEnRuta` en `Ruta.fromJson` (dejando elementos nulos al final) y visualización de dirección, cliente, teléfono, hora corta (`horaCorta`) y prioridad (`NORMAL`, `ALTA`, `URGENTE`).
   - Integración de `url_launcher: ^6.3.3` en `PedidoTile` (`Abrir en Maps` por coordenadas o dirección de respaldo) junto con `<queries>` para `https` y `geo` en `mobile/android/app/src/main/AndroidManifest.xml`.
   - Recarga por pull-to-refresh (`RefreshIndicator` + `AlwaysScrollableScrollPhysics`), botón manual de recarga y vista dedicada cuando el backend responde `404` (`No tienes una ruta asignada`).
   - Confirmación explícita mediante `AlertDialog` (`Confirmar entrega`) antes de ejecutar la transición irreversible a `ENTREGADO`.
   - Escucha continua de `/topic/rutas` por STOMP con notificación `"Tu ruta fue actualizada"` cuando cambia la ruta asignada y mapa de mensajes comprensibles ante falta de red/timeout (`SinConexionException`), permiso denegado (`403`) o transición inválida (`409`).

2. **Login del repartidor y manejo de sesión (`feature/mobile-login`)**:
   - Configuración parametrizable en `mobile/lib/config.dart` (`API_URL`, `wsUrl`, `AUTH_HABILITADA`, `PERMITIR_ID_TEMPORAL`).
   - Modelos y servicios de autenticación (`Sesion`, `SesionService` sobre `SharedPreferences: ^2.5.6`, `ApiService.iniciarSesion` contra `POST /api/auth/login`).
   - Validación estricta del rol `COURIER` con `repartidorId > 0` (rechazando usuarios `STAFF`), guardado automático de sesión, cierre de sesión desde el `AppBar` y limpieza automática con retorno a `LoginScreen` cuando una petición recibe `401`.
   - Envío de cabecera `Authorization: Bearer <token>` tanto en peticiones HTTP como en `stompConnectHeaders` del frame `CONNECT` de STOMP (`StompService`).
   - Conservación temporal del enlace `"Ingresar por ID (temporal)"` hacia `SeleccionRepartidorScreen` mientras `backend/` concluye la publicación del endpoint `/api/auth/login`.

3. **Pruebas unitarias, de widgets e integración CP-11 (`feature/mobile-pruebas`)**:
   - Cobertura completa de modelos (`modelos_test.dart`), `ApiService`, `SesionService`, `StompService`, `PedidoTile`, `LoginScreen`, `RutaScreen` y `SeleccionRepartidorScreen` simulando HTTP con `MockClient`, preferencias con `SharedPreferences.setMockInitialValues` y cliente STOMP falso.
   - Implementación en `mobile/integration_test/app_test.dart` de tres casos: smoke de arranque en `LoginScreen`, flujo integrado completo de `CP-11` con HTTP/STOMP simulados (login, paradas en orden, Maps, cancelación/confirmación de entrega, inserción de último momento por `/topic/rutas` y logout) y caso real contra backend levantado activable con `--dart-define=EJECUTAR_E2E=true`.

## 3. Verificación ejecutada y resultados observados

Verificado sobre la rama `feature/mobile-pruebas` (`6c3a045`) con Flutter `3.50.0` / Dart `3.14.0`:

| Comando | Resultado observado | Observaciones |
|---|---|---|
| `flutter analyze --no-fatal-infos` | Código de salida `0` | `0` errores y `0` advertencias. (`flutter analyze` sin flag devuelve código `1` bajo Flutter `3.50.0` únicamente por 10 avisos `info` de deprecación de `package:flutter/material.dart` introducida tras `v3.47.0-0.0.pre`; se conservó ese import por compatibilidad con Flutter `3.47.x` del equipo). |
| `flutter test -r expanded` | **47 pruebas pasaron, 0 fallos** (`+47`) | Suites en `test/models/`, `test/services/`, `test/widgets/` y `test/screens/`. |
| `flutter test -d flutter-tester -r expanded integration_test/app_test.dart` | **2 pasaron, 1 omitida** (`+2 ~1`) | Pasaron el smoke de inicio y el flujo integrado `CP-11` simulado; la prueba contra backend real permanece omitida (`skip: !_ejecutarE2E`) hasta ejecutar con `--dart-define=EJECUTAR_E2E=true`. |

## 4. Pendientes y bloqueantes reportados al equipo

Para completar el 100 % de la lista de verificación de entrega quedan dos dependencias de entorno e integración:

1. **Android SDK y dispositivo/emulador**: En este equipo `flutter doctor -v` reporta `[X] Unable to locate Android SDK`, por lo que **no fue posible** generar todavía el artefacto (`flutter build apk`) ni correr `integration_test` en emulador o teléfono Android real.
2. **Endpoint `/api/auth/login` en `backend/`**: Una vez que Joseph publique autenticación en `develop`, corresponde ejecutar `flutter test integration_test/app_test.dart --dart-define=EJECUTAR_E2E=true` junto con Mauricio (`CP-11` web + móvil), tomar las capturas finales en `docs/evidencias/mobile/` y retirar el acceso temporal por ID cuando se valide en vivo.
