import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:integration_test/integration_test.dart';
import 'package:logistica_repartidor/config.dart';
import 'package:logistica_repartidor/main.dart' as app;
import 'package:logistica_repartidor/models/sesion.dart';
import 'package:logistica_repartidor/screens/login_screen.dart';
import 'package:logistica_repartidor/screens/ruta_screen.dart';
import 'package:logistica_repartidor/screens/seleccion_repartidor_screen.dart';
import 'package:logistica_repartidor/services/sesion_service.dart';
import 'package:logistica_repartidor/services/stomp_service.dart';
import 'package:logistica_repartidor/widgets/pedido_tile.dart';

/// Pruebas de integracion del repartidor (incluye CP-11).
///
/// Ejecucion local sin emulador (smoke + flujo completo CP-11 simulado):
///   flutter test -d flutter-tester integration_test/app_test.dart
///
/// Ejecucion contra backend real levantado en emulador/dispositivo:
///   flutter test integration_test/app_test.dart \
///     --dart-define=EJECUTAR_E2E=true \
///     --dart-define=API_URL=http://10.0.2.2:8080 \
///     --dart-define=USUARIO_TEST=repartidor1 \
///     --dart-define=CLAVE_TEST=repartidor123
const bool _ejecutarE2E = bool.fromEnvironment('EJECUTAR_E2E', defaultValue: false);
const bool _e2eConAuth = bool.fromEnvironment('E2E_CON_AUTH', defaultValue: authHabilitada);
const String _usuarioE2E = String.fromEnvironment('USUARIO_TEST', defaultValue: 'repartidor1');
const String _claveE2E = String.fromEnvironment('CLAVE_TEST', defaultValue: 'repartidor123');
const String _repartidorIdE2E = String.fromEnvironment('REPARTIDOR_ID_TEST', defaultValue: '1');

class _SesionEnMemoria extends SesionService {
  Sesion? _sesion;

  @override
  Future<Sesion?> obtenerSesion() async => _sesion;

  @override
  Future<String?> obtenerToken() async => _sesion?.token;

  @override
  Future<void> guardarSesion(Sesion sesion) async {
    _sesion = sesion;
  }

  @override
  Future<void> cerrarSesion() async {
    _sesion = null;
  }
}

class _StompSimulado extends StompService {
  void Function()? _alCambiarRutas;
  void Function(bool conectado)? _alCambiarConexion;
  String? tokenConectado;
  bool desconectado = false;

  @override
  void conectar({
    required void Function() alCambiarRutas,
    void Function(bool conectado)? alCambiarConexion,
    String? token,
  }) {
    _alCambiarRutas = alCambiarRutas;
    _alCambiarConexion = alCambiarConexion;
    tokenConectado = token;
    Future.microtask(() => _alCambiarConexion?.call(true));
  }

  void emitirCambioRutas() => _alCambiarRutas?.call();

  @override
  void desconectar() {
    desconectado = true;
  }
}

http.Response _json(Object cuerpo, int status) => http.Response(
      jsonEncode(cuerpo),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Future<void> _esperarHasta(
  WidgetTester tester,
  bool Function() condicion, {
  Duration timeout = const Duration(seconds: 15),
  String motivo = 'La condición esperada no se cumplió dentro del tiempo límite.',
}) async {
  final limite = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(limite)) {
    await tester.pump(const Duration(milliseconds: 200));
    if (condicion()) {
      await tester.pumpAndSettle();
      return;
    }
  }
  fail(motivo);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Flujo del repartidor', () {
    testWidgets('al abrir la app sin sesion muestra la pantalla de login', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      expect(find.text('Ingreso de repartidor'), findsOneWidget);
      expect(find.text('Ingresar'), findsOneWidget);
    });

    testWidgets(
      'CP-11 flujo completo con HTTP y STOMP simulados: login, ruta en orden, Maps, tiempo real y entrega',
      (tester) async {
        final sesionService = _SesionEnMemoria();
        final stomp = _StompSimulado();
        Uri? mapsUriLanzado;

        final pedidosServidor = <Map<String, dynamic>>[
          {
            'id': 101,
            'clienteNombres': 'Maria Torres',
            'clienteTelefono': '0982000001',
            'direccion': 'Bolivar y Mera',
            'horaEntrega': '09:30:00',
            'prioridad': 'URGENTE',
            'estado': 'ASIGNADO',
            'ordenEnRuta': 1,
            'latitud': -1.2412,
            'longitud': -78.6197,
          },
          {
            'id': 102,
            'clienteNombres': 'Luis Perez',
            'clienteTelefono': '0991112233',
            'direccion': 'Av. Cevallos 420',
            'horaEntrega': '10:15:00',
            'prioridad': 'NORMAL',
            'estado': 'ASIGNADO',
            'ordenEnRuta': 2,
            'latitud': -1.2450,
            'longitud': -78.6210,
          },
        ];

        final pathsRecibidos = <String>[];
        final authHeaders = <String?>[];

        final cliente = MockClient((req) async {
          pathsRecibidos.add('${req.method} ${req.url.path}');
          if (req.method == 'POST' && req.url.path == '/api/auth/login') {
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            if (body['usuario'] == 'carlos' && body['clave'] == '1234') {
              return _json({'token': 'jwt-e2e-3', 'rol': 'COURIER', 'repartidorId': 3}, 200);
            }
            return _json({'mensaje': 'Credenciales invalidas'}, 401);
          }

          authHeaders.add(req.headers['Authorization']);

          if (req.method == 'GET' && req.url.path == '/api/repartidores/3/ruta-actual') {
            return _json({
              'id': 15,
              'fecha': '2026-11-25',
              'zonaNombre': 'Centro',
              'repartidorNombre': 'Carlos Mena',
              'estado': 'ARMADA',
              'maxPedidos': 5,
              'pedidos': pedidosServidor,
            }, 200);
          }

          if (req.method == 'PATCH' && req.url.path.startsWith('/api/pedidos/')) {
            final id = int.parse(req.url.pathSegments[2]);
            final nuevoEstado = (jsonDecode(req.body) as Map<String, dynamic>)['estado'] as String;
            final indice = pedidosServidor.indexWhere((p) => p['id'] == id);
            if (indice >= 0) {
              pedidosServidor[indice] = {...pedidosServidor[indice], 'estado': nuevoEstado};
              return _json(pedidosServidor[indice], 200);
            }
          }

          return http.Response('No encontrado', 404);
        });

        await tester.pumpWidget(
          app.LogisticaApp(
            sesionService: sesionService,
            urlBase: 'http://servidor.local',
            clienteHttp: cliente,
            stomp: stomp,
            lanzarUrl: (uri) async {
              mapsUriLanzado = uri;
              return true;
            },
          ),
        );
        await tester.pumpAndSettle();

        // 1. Login del repartidor
        await tester.enterText(find.byKey(const Key('campoUsuario')), 'carlos');
        await tester.enterText(find.byKey(const Key('campoClave')), '1234');
        await tester.tap(find.byKey(const Key('botonIngresar')));
        await tester.pumpAndSettle();

        expect(find.byType(RutaScreen), findsOneWidget);
        expect(find.text('Mi ruta · repartidor 3'), findsOneWidget);
        expect(stomp.tokenConectado, 'jwt-e2e-3');
        expect(find.byTooltip('Tiempo real conectado'), findsOneWidget);

        if (find.byType(PedidoTile).evaluate().isEmpty) {
          final textos = tester.widgetList<Text>(find.byType(Text)).map((t) => t.data).toList();
          fail('No se renderizaron pedidos. Textos visibles: $textos, paths: $pathsRecibidos, auth: $authHeaders');
        }
        expect(authHeaders, isNotEmpty);
        expect(authHeaders, everyElement('Bearer jwt-e2e-3'));

        // 2. Verifica paradas en orden
        final yPrimera = tester.getTopLeft(find.text('Bolivar y Mera')).dy;
        final ySegunda = tester.getTopLeft(find.text('Av. Cevallos 420')).dy;
        expect(yPrimera, lessThan(ySegunda));

        // 3. Abrir en Google Maps
        await tester.tap(find.text('Abrir en Maps').first);
        await tester.pump();
        expect(mapsUriLanzado?.queryParameters['query'], '-1.2412,-78.6197');

        // 4. Avanzar estado ASIGNADO -> RECOGIDO -> EN_CAMINO -> ENTREGADO (cancelando una vez y confirmando luego)
        await tester.tap(find.text('Marcar como recogido').first);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Marcar en camino').first);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Marcar como entregado').first);
        await tester.pumpAndSettle();

        expect(find.text('Confirmar entrega'), findsOneWidget);
        await tester.tap(find.text('Cancelar'));
        await tester.pumpAndSettle();
        expect(find.text('Marcar como entregado'), findsOneWidget);

        await tester.tap(find.text('Marcar como entregado').first);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Confirmar'));
        await tester.pumpAndSettle();

        expect(find.text('Entregado'), findsOneWidget);
        expect(pedidosServidor.first['estado'], 'ENTREGADO');

        // 5. Insercion de pedido de ultimo momento via STOMP (/topic/rutas)
        pedidosServidor.add({
          'id': 103,
          'clienteNombres': 'Sofia Paredes',
          'clienteTelefono': '0987654321',
          'direccion': 'Av. Atahualpa 890',
          'horaEntrega': '11:00:00',
          'prioridad': 'ALTA',
          'estado': 'ASIGNADO',
          'ordenEnRuta': 3,
          'latitud': -1.2510,
          'longitud': -78.6280,
        });
        stomp.emitirCambioRutas();
        await tester.pumpAndSettle();

        expect(find.text('Tu ruta fue actualizada'), findsOneWidget);
        expect(find.text('Av. Atahualpa 890'), findsOneWidget);

        // 6. Cerrar sesion vuelve a LoginScreen y desconecta STOMP
        await tester.tap(find.byTooltip('Cerrar sesión'));
        await tester.pumpAndSettle();

        expect(stomp.desconectado, isTrue);
        expect(find.byType(LoginScreen), findsOneWidget);
      },
    );

    testWidgets(
      'CP-11 contra backend real: login, ver ruta y marcar pedido como entregado',
      skip: !_ejecutarE2E,
      (tester) async {
        app.main();
        await tester.pumpAndSettle(const Duration(seconds: 1));

        // 1. Autenticar segun configuracion del backend
        if (find.byType(LoginScreen).evaluate().isNotEmpty) {
          if (_e2eConAuth) {
            await tester.enterText(find.byKey(const Key('campoUsuario')), _usuarioE2E);
            await tester.enterText(find.byKey(const Key('campoClave')), _claveE2E);
            await tester.tap(find.byKey(const Key('botonIngresar')));
          } else {
            await tester.tap(find.text('Ingresar por ID (temporal)'));
            await tester.pumpAndSettle();
            await tester.enterText(find.byType(TextField).first, _repartidorIdE2E);
            await tester.tap(find.text('Ver mi ruta'));
          }
        } else if (find.byType(SeleccionRepartidorScreen).evaluate().isNotEmpty) {
          await tester.enterText(find.byType(TextField).first, _repartidorIdE2E);
          await tester.tap(find.text('Ver mi ruta'));
        }

        await _esperarHasta(
          tester,
          () => find.byType(RutaScreen).evaluate().isNotEmpty,
          motivo: 'No se abrio RutaScreen tras iniciar sesion contra el backend.',
        );

        await _esperarHasta(
          tester,
          () => find.byType(PedidoTile).evaluate().isNotEmpty,
          motivo: 'El repartidor no tiene pedidos visibles en su ruta actual.',
        );

        // 2. Avanzar el primer pedido disponible hasta ENTREGADO (lado movil de CP-11)
        for (var paso = 0; paso < 4; paso++) {
          if (find.text('Marcar como recogido').evaluate().isNotEmpty) {
            await tester.tap(find.text('Marcar como recogido').first);
          } else if (find.text('Marcar en camino').evaluate().isNotEmpty) {
            await tester.tap(find.text('Marcar en camino').first);
          } else if (find.text('Marcar como entregado').evaluate().isNotEmpty) {
            await tester.tap(find.text('Marcar como entregado').first);
            await tester.pumpAndSettle();
            expect(find.text('Confirmar entrega'), findsOneWidget);
            await tester.tap(find.text('Confirmar'));
          } else {
            break;
          }
          await tester.pump(const Duration(milliseconds: 600));
          await tester.pumpAndSettle();
        }

        await _esperarHasta(
          tester,
          () => find.text('Entregado').evaluate().isNotEmpty,
          motivo: 'No se reflejo el estado ENTREGADO en la lista tras completar las transiciones.',
        );
      },
    );
  });
}
