import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/pedido.dart';
import '../models/ruta.dart';
import '../models/sesion.dart';

/// El repartidor no tiene una ruta armada (la API responde 404).
class SinRutaException implements Exception {
  @override
  String toString() => 'No tienes una ruta asignada en este momento.';
}

/// Falla de red, DNS o tiempo de espera agotado al comunicarse con el servidor.
class SinConexionException implements Exception {
  final String mensaje;

  SinConexionException([
    this.mensaje = 'Sin conexión a internet. Verifica tu red e intenta nuevamente.',
  ]);

  @override
  String toString() => mensaje;
}

/// Error devuelto por la API (cuerpo { codigo, mensaje }).
class ApiException implements Exception {
  final int status;
  final String mensaje;
  final String? codigo;

  ApiException(this.status, this.mensaje, {this.codigo});

  /// Mensaje comprensible para mostrar en pantalla según el código HTTP.
  String get mensajeUsuario {
    switch (status) {
      case 401:
        return 'Tu sesión no es válida o expiró. Inicia sesión nuevamente.';
      case 403:
        return _esMensajeGenerico
            ? 'No tienes permiso para acceder o modificar esta ruta porque no está asignada a tu usuario.'
            : mensaje;
      case 409:
        return _esMensajeGenerico
            ? 'La transición de estado no es válida. Desliza hacia abajo para actualizar tu ruta.'
            : 'Transición no válida: $mensaje';
      default:
        return _esMensajeGenerico ? 'Ocurrió un error al comunicarse con el servidor ($status).' : mensaje;
    }
  }

  bool get _esMensajeGenerico {
    final normalizado = mensaje.trim().toLowerCase();
    return normalizado.isEmpty ||
        normalizado == 'error $status' ||
        normalizado == 'forbidden' ||
        normalizado == 'access denied' ||
        normalizado == 'conflict';
  }

  @override
  String toString() => mensaje;
}

class ApiService {
  final http.Client _cliente;
  final String _urlBase;
  final Duration _tiempoEspera;
  final FutureOr<String?> Function() _obtenerToken;
  final Future<void> Function() _alExpirarSesion;

  static Future<void> _sinExpiracion() async {}

  ApiService({
    http.Client? cliente,
    String? urlBase,
    Duration? tiempoEspera,
    String? token,
    FutureOr<String?> Function()? obtenerToken,
    Future<void> Function()? alExpirarSesion,
  })  : _cliente = cliente ?? http.Client(),
        _urlBase = urlBase ?? apiUrl,
        _tiempoEspera = tiempoEspera ?? const Duration(seconds: 15),
        _obtenerToken = obtenerToken ?? (() => token),
        _alExpirarSesion = alExpirarSesion ?? _sinExpiracion;

  Future<Map<String, String>> _cabeceras({bool conJson = false}) async {
    final tokenActual = await _obtenerToken();
    return {
      if (conJson) 'Content-Type': 'application/json',
      if (tokenActual != null && tokenActual.isNotEmpty) 'Authorization': 'Bearer $tokenActual',
    };
  }

  /// POST /api/auth/login con { usuario, clave } -> { token, rol, repartidorId }.
  Future<Sesion> iniciarSesion(String usuario, String clave) async {
    final respuesta = await _ejecutar(
      () => _cliente.post(
        Uri.parse('$_urlBase/api/auth/login'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({'usuario': usuario.trim(), 'clave': clave}),
      ),
    );
    if (respuesta.statusCode == 401) {
      final detalle = _extraerError(respuesta);
      final normalizado = detalle.mensaje.trim().toLowerCase();
      final mensaje = (normalizado.isEmpty ||
              normalizado == 'error 401' ||
              normalizado == 'unauthorized')
          ? 'Usuario o clave incorrectos'
          : detalle.mensaje;
      throw ApiException(401, mensaje, codigo: detalle.codigo);
    }
    await _validar(respuesta, manejarExpiracion: false);
    final sesion = Sesion.fromJson(jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>);
    if (sesion.token.isEmpty) {
      throw ApiException(500, 'La respuesta de autenticación no incluyó token.');
    }
    return sesion;
  }

  /// GET /api/repartidores/{id}/ruta-actual
  Future<Ruta> obtenerRutaActual(int repartidorId) async {
    final cabeceras = await _cabeceras();
    final respuesta = await _ejecutar(
      () => _cliente.get(
        Uri.parse('$_urlBase/api/repartidores/$repartidorId/ruta-actual'),
        headers: cabeceras,
      ),
    );
    if (respuesta.statusCode == 404) {
      throw SinRutaException();
    }
    await _validar(respuesta);
    return Ruta.fromJson(jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>);
  }

  /// PATCH /api/pedidos/{id}/estado con origen MOVIL. El backend valida la transicion (409 si es invalida).
  Future<Pedido> cambiarEstado(int pedidoId, String nuevoEstado) async {
    final cabeceras = await _cabeceras(conJson: true);
    final respuesta = await _ejecutar(
      () => _cliente.patch(
        Uri.parse('$_urlBase/api/pedidos/$pedidoId/estado'),
        headers: cabeceras,
        body: jsonEncode({'estado': nuevoEstado, 'origen': 'MOVIL'}),
      ),
    );
    await _validar(respuesta);
    return Pedido.fromJson(jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>);
  }

  Future<http.Response> _ejecutar(Future<http.Response> Function() peticion) async {
    try {
      return await peticion().timeout(_tiempoEspera);
    } on SocketException {
      throw SinConexionException();
    } on TimeoutException {
      throw SinConexionException('El servidor tardó demasiado en responder. Verifica tu conexión.');
    } on http.ClientException {
      throw SinConexionException();
    }
  }

  Future<void> _validar(http.Response respuesta, {bool manejarExpiracion = true}) async {
    if (respuesta.statusCode >= 200 && respuesta.statusCode < 300) return;
    if (respuesta.statusCode == 401 && manejarExpiracion) {
      await _alExpirarSesion();
    }
    final detalle = _extraerError(respuesta);
    throw ApiException(respuesta.statusCode, detalle.mensaje, codigo: detalle.codigo);
  }

  ({String mensaje, String? codigo}) _extraerError(http.Response respuesta) {
    var mensaje = 'Error ${respuesta.statusCode}';
    String? codigo;
    try {
      final cuerpo = jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>;
      mensaje = cuerpo['mensaje'] as String? ?? mensaje;
      codigo = cuerpo['codigo'] as String?;
    } catch (_) {
      // el cuerpo no era JSON: se deja el mensaje generico
    }
    return (mensaje: mensaje, codigo: codigo);
  }
}
