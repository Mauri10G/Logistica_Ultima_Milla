import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_repartidor/models/sesion.dart';
import 'package:logistica_repartidor/services/sesion_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('guarda, recupera y elimina la sesion en SharedPreferences', () async {
    final servicio = SesionService();

    expect(await servicio.obtenerSesion(), isNull);
    expect(await servicio.obtenerToken(), isNull);

    const sesion = Sesion(token: 'jwt-repartidor-1', rol: 'COURIER', repartidorId: 4);
    await servicio.guardarSesion(sesion);

    final recuperada = await servicio.obtenerSesion();
    expect(recuperada, isNotNull);
    expect(recuperada!.token, 'jwt-repartidor-1');
    expect(recuperada.rol, 'COURIER');
    expect(recuperada.repartidorId, 4);
    expect(recuperada.esRepartidor, isTrue);
    expect(await servicio.obtenerToken(), 'jwt-repartidor-1');

    await servicio.cerrarSesion();
    expect(await servicio.obtenerSesion(), isNull);
    expect(await servicio.obtenerToken(), isNull);
  });

  test('ignora valores corruptos o sin token en SharedPreferences', () async {
    SharedPreferences.setMockInitialValues({
      SesionService.claveSesion: '{json-invalido',
    });
    final servicio = SesionService();
    expect(await servicio.obtenerSesion(), isNull);

    SharedPreferences.setMockInitialValues({
      SesionService.claveSesion: '{"token":"","rol":"COURIER","repartidorId":2}',
    });
    expect(await servicio.obtenerSesion(), isNull);
  });

  test('identifica si la sesion pertenece a un repartidor COURIER', () {
    const courier = Sesion(token: 't1', rol: 'COURIER', repartidorId: 2);
    const staff = Sesion(token: 't2', rol: 'STAFF', repartidorId: null);
    const sinId = Sesion(token: 't3', rol: 'COURIER', repartidorId: null);

    expect(courier.esRepartidor, isTrue);
    expect(staff.esRepartidor, isFalse);
    expect(sinId.esRepartidor, isFalse);
  });
}
