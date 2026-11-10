import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:logistica_repartidor/services/api_service.dart';

const _pedidoJson = {
  'id': 7,
  'clienteNombres': 'Maria Torres',
  'clienteTelefono': '0982000001',
  'direccion': 'Bolivar y Mera',
  'horaEntrega': '10:30:00',
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
  });

  test('una transicion invalida (409) se informa con el mensaje de la API', () async {
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => _json({'codigo': 'TRANSICION_INVALIDA', 'mensaje': 'Transicion invalida'}, 409)),
    );

    expect(
      () => api.cambiarEstado(7, 'ENTREGADO'),
      throwsA(isA<ApiException>().having((e) => e.mensaje, 'mensaje', 'Transicion invalida')),
    );
  });

  test('obtenerRutaActual ordena los pedidos por orden en la ruta', () async {
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
              {..._pedidoJson, 'id': 2, 'ordenEnRuta': 2, 'estado': 'ASIGNADO'},
              {..._pedidoJson, 'id': 1, 'ordenEnRuta': 1, 'estado': 'ASIGNADO'},
            ],
          }, 200)),
    );

    final ruta = await api.obtenerRutaActual(1);

    expect(ruta.pedidos.map((p) => p.id), [1, 2]);
    expect(ruta.zonaNombre, 'Centro');
  });

  test('sin ruta activa (404) lanza SinRutaException', () async {
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async => _json({'mensaje': 'El repartidor no tiene una ruta activa'}, 404)),
    );

    expect(() => api.obtenerRutaActual(1), throwsA(isA<SinRutaException>()));
  });
}
