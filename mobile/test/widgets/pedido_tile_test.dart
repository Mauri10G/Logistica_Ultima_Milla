import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_repartidor/models/pedido.dart';
import 'package:logistica_repartidor/widgets/pedido_tile.dart';

Pedido pedidoEn(String estado, {String prioridad = 'NORMAL'}) => Pedido(
      id: 7,
      clienteNombres: 'Maria Torres',
      clienteTelefono: '0982000001',
      direccion: 'Bolivar y Mera',
      horaEntrega: '10:30:00',
      prioridad: prioridad,
      estado: estado,
      ordenEnRuta: 2,
      latitud: -1.2412,
      longitud: -78.6197,
    );

Widget envolver(Widget hijo) => MaterialApp(home: Scaffold(body: hijo));

void main() {
  testWidgets('muestra direccion, cliente, hora, prioridad y estado del pedido', (tester) async {
    await tester.pumpWidget(
      envolver(PedidoTile(pedido: pedidoEn('EN_CAMINO', prioridad: 'URGENTE'), alCambiarEstado: (_) async {})),
    );

    expect(find.text('Bolivar y Mera'), findsOneWidget);
    expect(find.textContaining('Maria Torres'), findsOneWidget);
    expect(find.textContaining('10:30'), findsOneWidget);
    expect(find.text('Prioridad: URGENTE'), findsOneWidget);
    expect(find.text('EN_CAMINO'), findsOneWidget);
    expect(find.text('2'), findsOneWidget); // orden en la ruta
  });

  testWidgets('"Marcar como entregado" llama al cambio de estado con ENTREGADO', (tester) async {
    String? estadoPedido;
    await tester.pumpWidget(envolver(PedidoTile(
      pedido: pedidoEn('EN_CAMINO'),
      alCambiarEstado: (estado) async => estadoPedido = estado,
    )));

    await tester.tap(find.text('Marcar como entregado'));

    expect(estadoPedido, 'ENTREGADO');
  });

  testWidgets('el boton sigue el flujo ASIGNADO -> RECOGIDO -> EN_CAMINO -> ENTREGADO', (tester) async {
    for (final caso in {
      'ASIGNADO': 'Marcar como recogido',
      'RECOGIDO': 'Marcar en camino',
      'EN_CAMINO': 'Marcar como entregado',
    }.entries) {
      await tester.pumpWidget(envolver(PedidoTile(pedido: pedidoEn(caso.key), alCambiarEstado: (_) async {})));
      expect(find.text(caso.value), findsOneWidget, reason: 'estado ${caso.key}');
    }
  });

  testWidgets('un pedido ENTREGADO no ofrece mas acciones de estado', (tester) async {
    await tester.pumpWidget(envolver(PedidoTile(pedido: pedidoEn('ENTREGADO'), alCambiarEstado: (_) async {})));

    expect(find.byType(FilledButton), findsNothing);
    expect(find.text('Entregado'), findsOneWidget);
    expect(find.text('Abrir en Maps'), findsOneWidget);
  });

  testWidgets('"Abrir en Maps" invoca el lanzador con las coordenadas del pedido', (tester) async {
    Uri? uriLanzada;
    await tester.pumpWidget(
      envolver(
        PedidoTile(
          pedido: pedidoEn('ASIGNADO'),
          alCambiarEstado: (_) async {},
          lanzarUrl: (uri) async {
            uriLanzada = uri;
            return true;
          },
        ),
      ),
    );

    await tester.tap(find.text('Abrir en Maps'));
    await tester.pump();

    expect(uriLanzada?.host, 'www.google.com');
    expect(uriLanzada?.queryParameters['query'], '-1.2412,-78.6197');
  });

  testWidgets('si falla abrir Maps muestra un SnackBar informativo', (tester) async {
    await tester.pumpWidget(
      envolver(
        PedidoTile(
          pedido: pedidoEn('ASIGNADO'),
          alCambiarEstado: (_) async {},
          lanzarUrl: (_) async => false,
        ),
      ),
    );

    await tester.tap(find.text('Abrir en Maps'));
    await tester.pump();

    expect(find.text('No se pudo abrir Google Maps'), findsOneWidget);
  });

  testWidgets('cuando esta procesando deshabilita el boton de avance', (tester) async {
    var llamado = false;
    await tester.pumpWidget(
      envolver(
        PedidoTile(
          pedido: pedidoEn('ASIGNADO'),
          procesando: true,
          alCambiarEstado: (_) async => llamado = true,
        ),
      ),
    );

    await tester.tap(find.byType(FilledButton));
    expect(llamado, isFalse);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
