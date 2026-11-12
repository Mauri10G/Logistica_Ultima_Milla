import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:logistica_repartidor/screens/ruta_screen.dart';
import 'package:logistica_repartidor/services/api_service.dart';
import 'package:logistica_repartidor/services/stomp_service.dart';

class FakeStompService extends StompService {
  void Function()? alCambiarRutas;
  void Function(bool conectado)? alCambiarConexion;
  String? tokenRecibido;
  bool desconectado = false;

  @override
  void conectar({
    required void Function() alCambiarRutas,
    void Function(bool conectado)? alCambiarConexion,
    String? token,
  }) {
    this.alCambiarRutas = alCambiarRutas;
    this.alCambiarConexion = alCambiarConexion;
    tokenRecibido = token;
  }

  void emitirCambioRutas() => alCambiarRutas?.call();

  void emitirConexion(bool conectado) => alCambiarConexion?.call(conectado);

  @override
  void desconectar() {
    desconectado = true;
  }
}

http.Response _json(Object cuerpo, int status) =>
    http.Response(jsonEncode(cuerpo), status, headers: {'content-type': 'application/json; charset=utf-8'});

Map<String, dynamic> _rutaJson(List<Map<String, dynamic>> pedidos) => {
      'id': 10,
      'fecha': '2026-11-12',
      'zonaNombre': 'Centro',
      'repartidorNombre': 'Carlos Mena',
      'estado': 'ARMADA',
      'maxPedidos': 4,
      'pedidos': pedidos,
    };

Map<String, dynamic> _pedido({
  required int id,
  required int orden,
  required String direccion,
  String cliente = 'Maria Torres',
  String telefono = '0982000001',
  String hora = '10:30:00',
  String prioridad = 'NORMAL',
  String estado = 'ASIGNADO',
}) =>
    {
      'id': id,
      'clienteNombres': cliente,
      'clienteTelefono': telefono,
      'direccion': direccion,
      'horaEntrega': hora,
      'prioridad': prioridad,
      'estado': estado,
      'ordenEnRuta': orden,
      'latitud': -1.2412,
      'longitud': -78.6197,
    };

void main() {
  testWidgets('muestra las paradas ordenadas con direccion, cliente, hora y prioridad', (tester) async {
    final stomp = FakeStompService();
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => _json(
            _rutaJson([
              _pedido(id: 2, orden: 2, direccion: 'Sucre y Lalama', cliente: 'Jorge', prioridad: 'NORMAL'),
              _pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera', cliente: 'Sofia', prioridad: 'URGENTE'),
            ]),
            200,
          )),
    );

    await tester.pumpWidget(
      MaterialApp(home: RutaScreen(repartidorId: 1, api: api, stomp: stomp)),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Ruta 10 · Centro'), findsOneWidget);
    expect(find.text('Bolivar y Mera'), findsOneWidget);
    expect(find.text('Sucre y Lalama'), findsOneWidget);
    expect(find.textContaining('Sofia'), findsOneWidget);
    expect(find.text('Prioridad: URGENTE'), findsOneWidget);
    expect(find.text('Prioridad: NORMAL'), findsOneWidget);

    // Verificar que orden 1 aparece arriba del orden 2
    final yPrimero = tester.getTopLeft(find.text('Bolivar y Mera')).dy;
    final ySegundo = tester.getTopLeft(find.text('Sucre y Lalama')).dy;
    expect(yPrimero, lessThan(ySegundo));
  });

  testWidgets('muestra mensaje claro si no tiene ruta asignada y permite recargar', (tester) async {
    var llamadas = 0;
    final stomp = FakeStompService();
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async {
        llamadas++;
        if (llamadas == 1) {
          return _json({'mensaje': 'Sin ruta'}, 404);
        }
        return _json(_rutaJson([_pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera')]), 200);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: RutaScreen(repartidorId: 1, api: api, stomp: stomp)),
    );
    await tester.pumpAndSettle();

    expect(find.text('No tienes una ruta asignada'), findsOneWidget);

    await tester.tap(find.text('Recargar'));
    await tester.pumpAndSettle();

    expect(find.text('Bolivar y Mera'), findsOneWidget);
  });

  testWidgets('deslizar hacia abajo recarga la ruta', (tester) async {
    var llamadas = 0;
    final stomp = FakeStompService();
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async {
        llamadas++;
        final pedidos = [
          _pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera'),
          if (llamadas > 1) _pedido(id: 2, orden: 2, direccion: 'Cevallos y Montalvo'),
        ];
        return _json(_rutaJson(pedidos), 200);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: RutaScreen(repartidorId: 1, api: api, stomp: stomp)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cevallos y Montalvo'), findsNothing);

    await tester.fling(find.byType(ListView), const Offset(0, 300), 1000);
    await tester.pumpAndSettle();

    expect(llamadas, greaterThanOrEqualTo(2));
    expect(find.text('Cevallos y Montalvo'), findsOneWidget);
  });

  testWidgets('al llegar evento por /topic/rutas recarga automaticamente la ruta', (tester) async {
    var llamadas = 0;
    final stomp = FakeStompService();
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async {
        llamadas++;
        final pedidos = [
          _pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera'),
          if (llamadas > 1) _pedido(id: 99, orden: 2, direccion: 'Pedido Ultimo Momento', prioridad: 'URGENTE'),
        ];
        return _json(_rutaJson(pedidos), 200);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: RutaScreen(repartidorId: 1, api: api, stomp: stomp)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Pedido Ultimo Momento'), findsNothing);

    stomp.emitirCambioRutas();
    await tester.pumpAndSettle();

    expect(find.text('Pedido Ultimo Momento'), findsOneWidget);
    expect(find.text('Tu ruta fue actualizada'), findsOneWidget);
  });

  testWidgets('pide confirmacion antes de marcar entregado y respeta cancelar o confirmar', (tester) async {
    var patches = 0;
    var estadoActual = 'EN_CAMINO';
    final stomp = FakeStompService();
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((req) async {
        if (req.method == 'PATCH') {
          patches++;
          estadoActual = 'ENTREGADO';
          return _json(_pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera', estado: estadoActual), 200);
        }
        return _json(
          _rutaJson([_pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera', estado: estadoActual)]),
          200,
        );
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: RutaScreen(repartidorId: 1, api: api, stomp: stomp)),
    );
    await tester.pumpAndSettle();

    // Tocar marcar como entregado -> abre dialogo
    await tester.tap(find.text('Marcar como entregado'));
    await tester.pumpAndSettle();

    expect(find.text('Confirmar entrega'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(patches, 0);
    expect(find.text('Marcar como entregado'), findsOneWidget);

    // Volver a intentar y confirmar
    await tester.tap(find.text('Marcar como entregado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(patches, 1);
    expect(find.text('Entregado'), findsOneWidget);
  });

  testWidgets('muestra mensajes claros para 403, 409 y sin conexion', (tester) async {
    final stomp = FakeStompService();
    var modoError = 'CONEXION';
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((req) async {
        if (req.method == 'GET') {
          if (modoError == 'CONEXION') throw const SocketException('Sin internet');
          if (modoError == '403_GET') return http.Response('', 403);
          return _json(
            _rutaJson([_pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera', estado: 'ASIGNADO')]),
            200,
          );
        }
        if (modoError == '403_PATCH') return http.Response('', 403);
        if (modoError == '409_PATCH') {
          return _json({'codigo': 'TRANSICION_INVALIDA', 'mensaje': 'No se puede pasar de ASIGNADO a ENTREGADO'}, 409);
        }
        throw const SocketException('Sin red');
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: RutaScreen(repartidorId: 1, api: api, stomp: stomp)),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Sin conexión a internet'), findsOneWidget);

    // Probar 403 en carga
    modoError = '403_GET';
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No tienes permiso'), findsOneWidget);

    // Cargar ruta y probar 403 y 409 al avanzar estado
    modoError = '403_PATCH';
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Marcar como recogido'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No tienes permiso'), findsOneWidget);

    modoError = '409_PATCH';
    await tester.tap(find.text('Marcar como recogido'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Transición no válida'), findsOneWidget);

    modoError = 'CONEXION_PATCH';
    await tester.tap(find.text('Marcar como recogido'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Sin conexión a internet'), findsOneWidget);
  });

  testWidgets('abrir en Maps desde RutaScreen lanza la URL de Google Maps', (tester) async {
    Uri? uriLanzada;
    final stomp = FakeStompService();
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient(
        (_) async => _json(_rutaJson([_pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera')]), 200),
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: RutaScreen(
          repartidorId: 1,
          api: api,
          stomp: stomp,
          lanzarUrl: (uri) async {
            uriLanzada = uri;
            return true;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Abrir en Maps'));
    await tester.pump();

    expect(uriLanzada?.toString(), 'https://www.google.com/maps/search/?api=1&query=-1.2412%2C-78.6197');
  });

  testWidgets('pasa el token a STOMP y permite cerrar sesion', (tester) async {
    var cerroSesion = false;
    final stomp = FakeStompService();
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient(
        (_) async => _json(_rutaJson([_pedido(id: 1, orden: 1, direccion: 'Bolivar y Mera')]), 200),
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: RutaScreen(
          repartidorId: 1,
          token: 'jwt-en-ruta',
          api: api,
          stomp: stomp,
          alCerrarSesion: () async => cerroSesion = true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(stomp.tokenRecibido, 'jwt-en-ruta');

    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pumpAndSettle();

    expect(stomp.desconectado, isTrue);
    expect(cerroSesion, isTrue);
  });
}
