import 'package:stomp_dart_client/stomp_dart_client.dart';

import '../config.dart';

/// Escucha /topic/rutas del backend (WebSocket + STOMP) para refrescar la ruta cuando cambia.
class StompService {
  StompClient? _cliente;

  void conectar({required void Function() alCambiarRutas}) {
    _cliente = StompClient(
      config: StompConfig(
        url: wsUrl,
        reconnectDelay: const Duration(seconds: 3),
        onConnect: (StompFrame frame) {
          _cliente?.subscribe(
            destination: '/topic/rutas',
            callback: (StompFrame mensaje) => alCambiarRutas(),
          );
        },
        onWebSocketError: (dynamic error) {
          // sin tiempo real la app sigue funcionando: el usuario puede refrescar manualmente
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
