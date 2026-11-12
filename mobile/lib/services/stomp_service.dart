import 'package:stomp_dart_client/stomp_dart_client.dart';

import '../config.dart';

/// Escucha /topic/rutas del backend (WebSocket + STOMP) para refrescar la ruta cuando cambia.
class StompService {
  final StompClient Function(StompConfig config) _crearCliente;
  StompClient? _cliente;

  StompService({StompClient Function(StompConfig config)? crearCliente})
      : _crearCliente = crearCliente ?? ((config) => StompClient(config: config));

  /// Cabeceras enviadas en el frame CONNECT de STOMP.
  static Map<String, String>? cabecerasConnect(String? token) {
    if (token == null || token.isEmpty) return null;
    return {'Authorization': 'Bearer $token'};
  }

  void conectar({
    required void Function() alCambiarRutas,
    void Function(bool conectado)? alCambiarConexion,
    String? token,
  }) {
    _cliente?.deactivate();
    _cliente = _crearCliente(
      StompConfig(
        url: wsUrl,
        reconnectDelay: const Duration(seconds: 3),
        stompConnectHeaders: cabecerasConnect(token),
        onConnect: (StompFrame frame) {
          alCambiarConexion?.call(true);
          _cliente?.subscribe(
            destination: '/topic/rutas',
            callback: (StompFrame mensaje) => alCambiarRutas(),
          );
        },
        onDisconnect: (StompFrame frame) {
          alCambiarConexion?.call(false);
        },
        onStompError: (StompFrame frame) {
          alCambiarConexion?.call(false);
        },
        onWebSocketError: (dynamic error) {
          // sin tiempo real la app sigue funcionando: el usuario puede refrescar manualmente
          alCambiarConexion?.call(false);
        },
      ),
    );
    _cliente!.activate();
  }

  void desconectar() {
    _cliente?.deactivate();
    _cliente = null;
  }
}
