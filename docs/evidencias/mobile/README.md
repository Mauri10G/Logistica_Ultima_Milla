# Evidencias del módulo móvil (`mobile/`)

En esta carpeta se archivan las capturas y respaldos visuales de ejecución del módulo móvil para el informe final.

## Evidencias requeridas

1. `flutter-analyze.png` — Salida limpia de análisis estático (`0` errores, `0` advertencias).
2. `flutter-test.png` — Ejecución completa de la suite unitaria y de widgets (`flutter test -r expanded`).
3. `integration-test-cp11.png` — Ejecución de `integration_test/app_test.dart` contra backend real (`--dart-define=EJECUTAR_E2E=true`) o emulador Android.
4. `apk-login.png` — Pantalla de inicio de sesión (`COURIER`) y validación funcionando en APK instalado.
5. `apk-ruta-maps.png` — Lista de paradas ordenadas por `ordenEnRuta`, prioridades y apertura en Google Maps.
6. `apk-confirmar-entregado.png` — Diálogo `Confirmar entrega` y pedido actualizado en vivo por `/topic/rutas`.

## Comandos de verificación y generación (PowerShell desde `mobile/`)

```powershell
# 1. Análisis estático (usar --no-fatal-infos en Flutter >= 3.50 por compatibilidad con 3.47.x)
flutter analyze --no-fatal-infos

# 2. Pruebas unitarias y de widgets
flutter test -r expanded

# 3. Prueba de integración CP-11 simulada sin emulador
flutter test -d flutter-tester -r expanded integration_test/app_test.dart

# 4. Prueba de integración CP-11 contra backend real y emulador/dispositivo conectado
flutter test integration_test/app_test.dart `
  --dart-define=EJECUTAR_E2E=true `
  --dart-define=API_URL=http://10.0.2.2:8080 `
  --dart-define=USUARIO_TEST=repartidor1 `
  --dart-define=CLAVE_TEST=repartidor123

# 5. Compilación del APK de demostración (requiere Android SDK configurado)
flutter build apk --release
```

> **Estado actual**: Las verificaciones `1`, `2` (`47` pruebas) y `3` (`2` pruebas simuladas pasando, `1` real omitida) se ejecutaron en `feature/mobile-pruebas`. Los puntos `4` y `5` quedan pendientes hasta configurar el Android SDK en el equipo de demostración y contar con `/api/auth/login` desplegado en el backend.
