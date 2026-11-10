import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:logistica_repartidor/main.dart' as app;

/// Esqueleto de prueba de integracion (se ejecuta en un emulador o dispositivo):
///   flutter test integration_test
/// El flujo completo contra el backend queda como TODO del equipo.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Flujo del repartidor', () {
    testWidgets('al abrir la app se muestra la seleccion de repartidor', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      expect(find.text('Seleccione su repartidor'), findsOneWidget);
      expect(find.text('Ver mi ruta'), findsOneWidget);
    });

    // TODO: con el backend levantado (docker compose up -d + mvnw spring-boot:run):
    //  1. ingresar el id de un repartidor con ruta armada y tocar "Ver mi ruta"
    //  2. verificar que se listan los pedidos en orden
    //  3. tocar "Marcar como recogido" / "Marcar en camino" / "Marcar como entregado"
    //  4. verificar que el pedido queda ENTREGADO
  });
}
