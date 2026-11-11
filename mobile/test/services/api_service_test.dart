import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:logistica_repartidor/models/pedido.dart';
import 'package:logistica_repartidor/services/api_service.dart';

const _pedidoJson = {
  'id': 7,
  'clienteNombres': 'Maria Torres',
  'clienteTelefono': '0982000001',
  'direccion': 'Bolivar y Mera',
  'horaEntrega': '10:30:00',
  'prioridad': 'ALTA',
  'estado': 'ENTREGADO',
  'ordenEnRuta': 1,
  'latitud': -1.2412,
  'longitud': -78.6197,
};

http.Response _json(Object cuerpo, int status) =>
    http.Response(jsonEncode(cuerpo), status, headers: {'content-type': 'application/json; charset=utf-8'});

void main() {
  test('cambiarEstado hace PATCH con el estado y origen MOVIL', () async {
    late http.Request enviada;
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((peticion) async {
        enviada = peticion;
        return _json(_pedidoJson, 200);
      }),
    );

    final pedido = await api.cambiarEstado(7, 'ENTREGADO');

    expect(enviada.method, 'PATCH');
    expect(enviada.url.toString(), 'http://servidor/api/pedidos/7/estado');
    expect(jsonDecode(enviada.body), {'estado': 'ENTREGADO', 'origen': 'MOVIL'});
    expect(pedido.estado, 'ENTREGADO');
    expect(pedido.prioridad, 'ALTA');
  });

  test('una transicion invalida (409) se informa con el mensaje de la API', () async {
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => _json({'codigo': 'TRANSICION_INVALIDA', 'mensaje': 'Transicion invalida'}, 409)),
    );

    expect(
      () => api.cambiarEstado(7, 'ENTREGADO'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.status, 'status', 409)
            .having((e) => e.mensaje, 'mensaje', 'Transicion invalida')
            .having((e) => e.mensajeUsuario, 'mensajeUsuario', contains('Transicion invalida')),
      ),
    );
  });

  test('obtenerRutaActual ordena los pedidos por orden en la ruta y lee prioridad', () async {
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => _json({
            'id': 3,
            'fecha': '2027-02-14',
            'zonaNombre': 'Centro',
            'repartidorNombre': 'Carlos Mena',
            'estado': 'ARMADA',
            'maxPedidos': 4,
            'pedidos': [
              {..._pedidoJson, 'id': 3, 'ordenEnRuta': null, 'prioridad': 'NORMAL', 'estado': 'ASIGNADO'},
              {..._pedidoJson, 'id': 2, 'ordenEnRuta': 2, 'prioridad': 'URGENTE', 'estado': 'ASIGNADO'},
              {..._pedidoJson, 'id': 1, 'ordenEnRuta': 1, 'prioridad': 'ALTA', 'estado': 'ASIGNADO'},
            ],
          }, 200)),
    );

    final ruta = await api.obtenerRutaActual(1);

    expect(ruta.pedidos.map((p) => p.id), [1, 2, 3]);
    expect(ruta.pedidos.map((p) => p.prioridad), ['ALTA', 'URGENTE', 'NORMAL']);
    expect(ruta.zonaNombre, 'Centro');
  });

  test('sin ruta activa (404) lanza SinRutaException', () async {
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => _json({'mensaje': 'El repartidor no tiene una ruta activa'}, 404)),
    );

    expect(() => api.obtenerRutaActual(1), throwsA(isA<SinRutaException>()));
  });

  test('error 403 lanza ApiException con mensaje comprensible', () async {
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => http.Response('', 403)),
    );

    expect(
      () => api.obtenerRutaActual(1),
      throwsA(
        isA<ApiException>()
            .having((e) => e.status, 'status', 403)
            .having((e) => e.mensajeUsuario, 'mensajeUsuario', contains('No tienes permiso')),
      ),
    );
  });

  test('falla de red (SocketException o ClientException) lanza SinConexionException', () async {
    final apiSocket = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => throw const SocketException('Sin red')),
    );
    final apiCliente = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => throw http.ClientException('Connection closed')),
    );
    final apiTimeout = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => throw TimeoutException('Timeout')),
    );

    await expectLater(() => apiSocket.obtenerRutaActual(1), throwsA(isA<SinConexionException>()));
    await expectLater(() => apiCliente.cambiarEstado(7, 'RECOGIDO'), throwsA(isA<SinConexionException>()));
    await expectLater(() => apiTimeout.obtenerRutaActual(1), throwsA(isA<SinConexionException>()));
  });

  test('Pedido.uriGoogleMaps usa coordenadas y respalda con direccion si son cero', () {
    const conCoordenadas = Pedido(
      id: 1,
      clienteNombres: 'Ana',
      clienteTelefono: '099',
      direccion: 'Bolivar y Mera',
      horaEntrega: '09:00:00',
      estado: 'ASIGNADO',
      latitud: -1.2412,
      longitud: -78.6197,
    );
    const sinCoordenadas = Pedido(
      id: 2,
      clienteNombres: 'Luis',
      clienteTelefono: '098',
      direccion: 'Av. Cevallos 123',
      horaEntrega: '10:00:00',
      estado: 'ASIGNADO',
      latitud: 0,
      longitud: 0,
    );

    expect(
      conCoordenadas.uriGoogleMaps.toString(),
      'https://www.google.com/maps/search/?api=1&query=-1.2412%2C-78.6197',
    );
    expect(
      sinCoordenadas.uriGoogleMaps.queryParameters['query'],
      'Av. Cevallos 123',
    );
  });
}
