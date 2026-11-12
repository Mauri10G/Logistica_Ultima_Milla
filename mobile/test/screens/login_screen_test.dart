import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:logistica_repartidor/main.dart';
import 'package:logistica_repartidor/models/sesion.dart';
import 'package:logistica_repartidor/screens/login_screen.dart';
import 'package:logistica_repartidor/screens/ruta_screen.dart';
import 'package:logistica_repartidor/screens/seleccion_repartidor_screen.dart';
import 'package:logistica_repartidor/services/api_service.dart';
import 'package:logistica_repartidor/services/sesion_service.dart';
import 'package:logistica_repartidor/services/stomp_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeStompService extends StompService {
  String? tokenConectado;
  bool desconectado = false;

  @override
  void conectar({
    required void Function() alCambiarRutas,
    void Function(bool conectado)? alCambiarConexion,
    String? token,
  }) {
    tokenConectado = token;
  }

  @override
  void desconectar() {
    desconectado = true;
  }
}

http.Response _json(Object cuerpo, int status) =>
    http.Response(jsonEncode(cuerpo), status, headers: {'content-type': 'application/json; charset=utf-8'});

Map<String, dynamic> _rutaJson() => {
      'id': 15,
      'fecha': '2026-11-18',
      'zonaNombre': 'Centro',
      'repartidorNombre': 'Carlos Mena',
      'estado': 'ARMADA',
      'maxPedidos': 4,
      'pedidos': [
        {
          'id': 1,
          'clienteNombres': 'Maria Torres',
          'clienteTelefono': '0982000001',
          'direccion': 'Bolivar y Mera',
          'horaEntrega': '09:30:00',
          'prioridad': 'ALTA',
          'estado': 'ASIGNADO',
          'ordenEnRuta': 1,
          'latitud': -1.2412,
          'longitud': -78.6197,
        },
      ],
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('valida campos vacios antes de enviar el login', (tester) async {
    var peticiones = 0;
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async {
        peticiones++;
        return _json({}, 200);
      }),
    );

    await tester.pumpWidget(MaterialApp(home: LoginScreen(api: api)));
    await tester.tap(find.byKey(const Key('botonIngresar')));
    await tester.pump();

    expect(find.text('Ingrese su usuario'), findsOneWidget);
    expect(find.text('Ingrese su clave'), findsOneWidget);
    expect(peticiones, 0);
  });

  testWidgets('muestra error con credenciales invalidas (401) o rol STAFF', (tester) async {
    var modo = '401';
    final api = ApiService(
      urlBase: 'http://servidor',
      cliente: MockClient((_) async {
        if (modo == '401') return http.Response('', 401);
        if (modo == 'STAFF') return _json({'token': 'jwt-staff', 'rol': 'STAFF', 'repartidorId': null}, 200);
        throw const SocketException('Sin red');
      }),
    );

    await tester.pumpWidget(MaterialApp(home: LoginScreen(api: api)));

    await tester.enterText(find.byKey(const Key('campoUsuario')), 'carlos');
    await tester.enterText(find.byKey(const Key('campoClave')), 'incorrecta');
    await tester.tap(find.byKey(const Key('botonIngresar')));
    await tester.pumpAndSettle();
    expect(find.text('Usuario o clave incorrectos'), findsOneWidget);

    modo = 'STAFF';
    await tester.tap(find.byKey(const Key('botonIngresar')));
    await tester.pumpAndSettle();
    expect(find.text('Esta cuenta no corresponde a un repartidor.'), findsOneWidget);

    modo = 'RED';
    await tester.tap(find.byKey(const Key('botonIngresar')));
    await tester.pumpAndSettle();
    expect(find.textContaining('Sin conexión a internet'), findsOneWidget);
  });

  testWidgets('login exitoso guarda token en SharedPreferences, carga ruta y permite cerrar sesion', (tester) async {
    final sesionService = SesionService();
    final stomp = _FakeStompService();
    String? authHeaderEnRuta;
    final api = ApiService(
      urlBase: 'http://servidor',
      obtenerToken: sesionService.obtenerToken,
      cliente: MockClient((req) async {
        if (req.url.path == '/api/auth/login') {
          return _json({'token': 'jwt-courier-3', 'rol': 'COURIER', 'repartidorId': 3}, 200);
        }
        authHeaderEnRuta = req.headers['Authorization'];
        return _json(_rutaJson(), 200);
      }),
    );

    await tester.pumpWidget(
      LogisticaApp(
        sesionService: sesionService,
        api: api,
        stomp: stomp,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);

    await tester.enterText(find.byKey(const Key('campoUsuario')), 'carlos');
    await tester.enterText(find.byKey(const Key('campoClave')), '1234');
    await tester.tap(find.byKey(const Key('botonIngresar')));
    await tester.pumpAndSettle();

    expect(find.byType(RutaScreen), findsOneWidget);
    expect(find.text('Mi ruta · repartidor 3'), findsOneWidget);
    expect(find.text('Bolivar y Mera'), findsOneWidget);
    expect(authHeaderEnRuta, 'Bearer jwt-courier-3');
    expect(stomp.tokenConectado, 'jwt-courier-3');

    final guardada = await sesionService.obtenerSesion();
    expect(guardada?.token, 'jwt-courier-3');
    expect(guardada?.repartidorId, 3);

    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pumpAndSettle();

    expect(stomp.desconectado, isTrue);
    expect(await sesionService.obtenerSesion(), isNull);
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('si ya hay sesion guardada entra directo a RutaScreen sin pedir login', (tester) async {
    final sesionService = SesionService();
    await sesionService.guardarSesion(
      const Sesion(token: 'jwt-previo', rol: 'COURIER', repartidorId: 2),
    );
    final stomp = _FakeStompService();
    String? authHeader;
    final api = ApiService(
      urlBase: 'http://servidor',
      obtenerToken: sesionService.obtenerToken,
      cliente: MockClient((req) async {
        authHeader = req.headers['Authorization'];
        return _json(_rutaJson(), 200);
      }),
    );

    await tester.pumpWidget(
      LogisticaApp(
        sesionService: sesionService,
        api: api,
        stomp: stomp,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsNothing);
    expect(find.byType(RutaScreen), findsOneWidget);
    expect(find.text('Mi ruta · repartidor 2'), findsOneWidget);
    expect(authHeader, 'Bearer jwt-previo');
    expect(stomp.tokenConectado, 'jwt-previo');
  });

  testWidgets('con habilitaAuth false muestra SeleccionRepartidorScreen temporal', (tester) async {
    await tester.pumpWidget(
      const LogisticaApp(habilitaAuth: false),
    );
    await tester.pumpAndSettle();

    expect(find.byType(SeleccionRepartidorScreen), findsOneWidget);
  });

  testWidgets('si una peticion responde 401 borra sesion y vuelve a LoginScreen', (tester) async {
    final sesionService = SesionService();
    await sesionService.guardarSesion(
      const Sesion(token: 'jwt-vencido', rol: 'COURIER', repartidorId: 2),
    );
    final stomp = _FakeStompService();

    await tester.pumpWidget(
      LogisticaApp(
        sesionService: sesionService,
        urlBase: 'http://servidor',
        clienteHttp: MockClient((_) async => http.Response('', 401)),
        stomp: stomp,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text('Tu sesión expiró. Inicia sesión nuevamente.'), findsOneWidget);
    expect(await sesionService.obtenerSesion(), isNull);
  });

  testWidgets('acceso temporal por ID navega a SeleccionRepartidorScreen', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    await tester.tap(find.text('Ingresar por ID (temporal)'));
    await tester.pumpAndSettle();

    expect(find.byType(SeleccionRepartidorScreen), findsOneWidget);
  });
}
