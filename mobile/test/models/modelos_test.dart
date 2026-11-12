import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_repartidor/models/pedido.dart';
import 'package:logistica_repartidor/models/ruta.dart';
import 'package:logistica_repartidor/models/sesion.dart';

void main() {
  group('Pedido', () {
    test('fromJson aplica valores por defecto y calcula horaCorta y transiciones', () {
      final pedido = Pedido.fromJson({
        'id': 1,
        'clienteNombres': 'Juan Perez',
        'clienteTelefono': '0990001122',
        'direccion': 'Av. Cevallos 100',
        'horaEntrega': '08:45:00',
        'estado': 'ASIGNADO',
      });

      expect(pedido.prioridad, 'NORMAL');
      expect(pedido.ordenEnRuta, isNull);
      expect(pedido.latitud, 0);
      expect(pedido.longitud, 0);
      expect(pedido.horaCorta, '08:45');
      expect(pedido.siguienteEstado, 'RECOGIDO');
      expect(pedido.textoAccion, 'Marcar como recogido');
    });

    test('uriGoogleMaps usa coordenadas cuando existen y direccion cuando ambas son cero', () {
      const conCoordenadas = Pedido(
        id: 1,
        clienteNombres: 'Ana',
        clienteTelefono: '099',
        direccion: 'Bolivar y Mera',
        horaEntrega: '10:00:00',
        estado: 'ASIGNADO',
        latitud: -1.2412,
        longitud: -78.6197,
      );
      const sinCoordenadas = Pedido(
        id: 2,
        clienteNombres: 'Luis',
        clienteTelefono: '098',
        direccion: 'Bolivar y Mera, Ambato',
        horaEntrega: '10:30:00',
        estado: 'ASIGNADO',
        latitud: 0,
        longitud: 0,
      );

      expect(conCoordenadas.uriGoogleMaps.queryParameters['query'], '-1.2412,-78.6197');
      expect(sinCoordenadas.uriGoogleMaps.queryParameters['query'], 'Bolivar y Mera, Ambato');
    });

    test('PENDIENTE y ENTREGADO no exponen siguienteEstado ni textoAccion', () {
      const pendiente = Pedido(
        id: 3,
        clienteNombres: 'Ana',
        clienteTelefono: '099',
        direccion: 'Centro',
        horaEntrega: '12:00',
        estado: 'PENDIENTE',
        latitud: -1.2,
        longitud: -78.6,
      );
      const entregado = Pedido(
        id: 4,
        clienteNombres: 'Ana',
        clienteTelefono: '099',
        direccion: 'Centro',
        horaEntrega: '12:00',
        estado: 'ENTREGADO',
        latitud: -1.2,
        longitud: -78.6,
      );

      expect(pendiente.siguienteEstado, isNull);
      expect(pendiente.textoAccion, isNull);
      expect(entregado.siguienteEstado, isNull);
      expect(entregado.textoAccion, isNull);
    });
  });

  group('Ruta', () {
    test('fromJson tolera pedidos nulos u ordenes nulos dejandolos al final', () {
      final rutaVacia = Ruta.fromJson({'id': 5});
      expect(rutaVacia.pedidos, isEmpty);

      final ruta = Ruta.fromJson({
        'id': 6,
        'fecha': '2026-11-25',
        'zonaNombre': 'Norte',
        'repartidorNombre': 'Carlos',
        'estado': 'ARMADA',
        'maxPedidos': 5,
        'pedidos': [
          {'id': 1, 'estado': 'ASIGNADO', 'direccion': 'Sin orden'},
          {'id': 2, 'estado': 'ASIGNADO', 'direccion': 'Segunda', 'ordenEnRuta': 2},
          {'id': 3, 'estado': 'ASIGNADO', 'direccion': 'Primera', 'ordenEnRuta': 1},
        ],
      });

      expect(ruta.pedidos.map((p) => p.direccion).toList(), ['Primera', 'Segunda', 'Sin orden']);
    });
  });

  group('Sesion', () {
    test('esRepartidor valida rol COURIER y repartidorId positivo', () {
      expect(const Sesion(token: 'a', rol: 'courier', repartidorId: 4).esRepartidor, isTrue);
      expect(const Sesion(token: 'a', rol: 'STAFF', repartidorId: null).esRepartidor, isFalse);
      expect(const Sesion(token: 'a', rol: 'COURIER', repartidorId: 0).esRepartidor, isFalse);
      expect(const Sesion(token: 'a', rol: 'COURIER', repartidorId: null).esRepartidor, isFalse);
    });
  });
}

