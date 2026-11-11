import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:logistica_repartidor/screens/ruta_screen.dart';
import 'package:logistica_repartidor/screens/seleccion_repartidor_screen.dart';
import 'package:logistica_repartidor/services/api_service.dart';
import 'package:logistica_repartidor/services/stomp_service.dart';

class _FakeStompService extends StompService {
  @override
  void conectar({
    required void Function() alCambiarRutas,
    void Function(bool conectado)? alCambiarConexion,
  }) {}

  @override
  void desconectar() {}
}

void main() {
  testWidgets('muestra error si el id del repartidor no es valido', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SeleccionRepartidorScreen()));

    await tester.tap(find.text('Ver mi ruta'));
    await tester.pump();

    expect(find.text('Ingrese un id de repartidor valido'), findsOneWidget);
  });

  testWidgets('navega a RutaScreen cuando el id es valido', (tester) async {
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient(
        (_) async => http.Response(jsonEncode({'mensaje': 'Sin ruta'}), 404),
      ),
    );

    await tester.pumpWidget(
      MaterialApp(home: SeleccionRepartidorScreen(api: api, stomp: _FakeStompService())),
    );

    await tester.enterText(find.byType(TextField), '1');
    await tester.tap(find.text('Ver mi ruta'));
    await tester.pumpAndSettle();

    expect(find.byType(RutaScreen), findsOneWidget);
    expect(find.text('No tienes una ruta asignada'), findsOneWidget);
  });
}