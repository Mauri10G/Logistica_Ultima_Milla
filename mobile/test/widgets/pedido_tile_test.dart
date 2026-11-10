import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_repartidor/models/pedido.dart';
import 'package:logistica_repartidor/widgets/pedido_tile.dart';

Pedido pedidoEn(String estado) => Pedido(
      id: 7,
      clienteNombres: 'Maria Torres',
      clienteTelefono: '0982000001',
      direccion: 'Bolivar y Mera',
      horaEntrega: '10:30:00',
      estado: estado,
      ordenEnRuta: 2,
      latitud: -1.2412,
      longitud: -78.6197,
    );

Widget envolver(Widget hijo) => MaterialApp(home: Scaffold(body: hijo));

void main() {
  testWidgets('muestra direccion, cliente, hora y estado del pedido', (tester) async {
    await tester.pumpWidget(envolver(PedidoTile(pedido: pedidoEn('EN_CAMINO'), alCambiarEstado: (_) async {})));

    expect(find.text('Bolivar y Mera'), findsOneWidget);
    expect(find.textContaining('Maria Torres'), findsOneWidget);
    expect(find.textContaining('10:30'), findsOneWidget);
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

  testWidgets('un pedido ENTREGADO no ofrece mas acciones', (tester) async {
    await tester.pumpWidget(envolver(PedidoTile(pedido: pedidoEn('ENTREGADO'), alCambiarEstado: (_) async {})));

    expect(find.byType(FilledButton), findsNothing);
    expect(find.text('Entregado'), findsOneWidget);
  });
}
