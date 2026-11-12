import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_repartidor/services/stomp_service.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';

class _FakeStompClient extends StompClient {
  bool activado = false;
  bool desactivado = false;
  String? destinoSuscrito;
  StompFrameCallback? callbackSuscrito;

  _FakeStompClient({required super.config});

  @override
  void activate() {
    activado = true;
    config.onConnect(StompFrame(command: 'CONNECTED'));
  }

  @override
  StompUnsubscribe subscribe({
    required String destination,
    required StompFrameCallback callback,
    Map<String, String>? headers,
  }) {
    destinoSuscrito = destination;
    callbackSuscrito = callback;
    return ({Map<String, String>? unsubscribeHeaders}) {};
  }

  @override
  void deactivate() {
    desactivado = true;
  }
}

void main() {
  test('cabecerasConnect incluye Authorization Bearer cuando hay token', () {
    expect(StompService.cabecerasConnect(null), isNull);
    expect(StompService.cabecerasConnect(''), isNull);
    expect(
      StompService.cabecerasConnect('jwt-123'),
      {'Authorization': 'Bearer jwt-123'},
    );
  });

  test('conectar envia el token en stompConnectHeaders y escucha /topic/rutas', () {
    late StompConfig configUsada;
    late _FakeStompClient clienteFalso;
    var cambiosRutas = 0;
    var estadoConexion = false;

    final stomp = StompService(
      crearCliente: (config) {
        configUsada = config;
        clienteFalso = _FakeStompClient(config: config);
        return clienteFalso;
      },
    );

    stomp.conectar(
      token: 'jwt-repartidor',
      alCambiarRutas: () => cambiosRutas++,
      alCambiarConexion: (conectado) => estadoConexion = conectado,
    );

    expect(clienteFalso.activado, isTrue);
    expect(configUsada.stompConnectHeaders, {'Authorization': 'Bearer jwt-repartidor'});
    expect(clienteFalso.destinoSuscrito, '/topic/rutas');
    expect(estadoConexion, isTrue);

    clienteFalso.callbackSuscrito?.call(StompFrame(command: 'MESSAGE', body: '{}'));
    expect(cambiosRutas, 1);

    stomp.desconectar();
    expect(clienteFalso.desactivado, isTrue);
  });
}
