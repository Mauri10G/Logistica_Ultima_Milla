/// URL base de la API. Por defecto apunta al localhost de la PC visto desde el emulador Android (10.0.2.2).
/// Para un celular fisico o iOS: flutter run --dart-define=API_URL=http://192.168.1.10:8080
const String apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8080');

/// Endpoint STOMP sobre WebSocket nativo del backend (ws://host:8080/ws).
String get wsUrl => '${apiUrl.replaceFirst(RegExp(r'^http'), 'ws')}/ws';

/// Exige login al abrir la app (true por defecto). Con false usa la seleccion temporal por id.
const bool authHabilitada = bool.fromEnvironment('AUTH_HABILITADA', defaultValue: true);

/// Permite navegar temporalmente a la seleccion por id desde LoginScreen mientras el backend publica /api/auth/login.
const bool permitirIdTemporal = bool.fromEnvironment('PERMITIR_ID_TEMPORAL', defaultValue: true);
