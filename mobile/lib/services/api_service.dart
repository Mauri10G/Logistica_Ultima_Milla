import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/pedido.dart';
import '../models/ruta.dart';

/// El repartidor no tiene una ruta armada (la API responde 404).
class SinRutaException implements Exception {
  @override
  String toString() => 'El repartidor no tiene una ruta activa';
}

/// Error devuelto por la API (cuerpo { codigo, mensaje }).
class ApiException implements Exception {
  final int status;
  final String mensaje;

  ApiException(this.status, this.mensaje);

  @override
  String toString() => mensaje;
}

class ApiService {
  final http.Client _cliente;
  final String _urlBase;

  ApiService({http.Client? cliente, String? urlBase})
      : _cliente = cliente ?? http.Client(),
        _urlBase = urlBase ?? apiUrl;

  /// GET /api/repartidores/{id}/ruta-actual
  Future<Ruta> obtenerRutaActual(int repartidorId) async {
    final respuesta = await _cliente.get(Uri.parse('$_urlBase/api/repartidores/$repartidorId/ruta-actual'));
    if (respuesta.statusCode == 404) {
      throw SinRutaException();
    }
    _validar(respuesta);
    return Ruta.fromJson(jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>);
  }

  /// PATCH /api/pedidos/{id}/estado con origen MOVIL. El backend valida la transicion (409 si es invalida).
  Future<Pedido> cambiarEstado(int pedidoId, String nuevoEstado) async {
    final respuesta = await _cliente.patch(
      Uri.parse('$_urlBase/api/pedidos/$pedidoId/estado'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'estado': nuevoEstado, 'origen': 'MOVIL'}),
    );
    _validar(respuesta);
    return Pedido.fromJson(jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>);
  }

  void _validar(http.Response respuesta) {
    if (respuesta.statusCode >= 200 && respuesta.statusCode < 300) return;
    var mensaje = 'Error ${respuesta.statusCode}';
    try {
      final cuerpo = jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>;
      mensaje = cuerpo['mensaje'] as String? ?? mensaje;
    } catch (_) {
      // el cuerpo no era JSON: se deja el mensaje generico
    }
    throw ApiException(respuesta.statusCode, mensaje);
  }
}
