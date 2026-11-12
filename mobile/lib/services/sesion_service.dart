import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/sesion.dart';

/// Persiste la sesion (token, rol y repartidorId) en SharedPreferences.
class SesionService {
  static const String claveSesion = 'logistica.sesion';

  final Future<SharedPreferences> Function() _obtenerPreferencias;

  SesionService({Future<SharedPreferences> Function()? obtenerPreferencias})
      : _obtenerPreferencias = obtenerPreferencias ?? SharedPreferences.getInstance;

  Future<Sesion?> obtenerSesion() async {
    final prefs = await _obtenerPreferencias();
    final bruto = prefs.getString(claveSesion);
    if (bruto == null || bruto.isEmpty) return null;
    try {
      final datos = jsonDecode(bruto) as Map<String, dynamic>;
      final sesion = Sesion.fromJson(datos);
      if (sesion.token.isEmpty) return null;
      return sesion;
    } catch (_) {
      return null;
    }
  }

  Future<String?> obtenerToken() async {
    return (await obtenerSesion())?.token;
  }

  Future<void> guardarSesion(Sesion sesion) async {
    final prefs = await _obtenerPreferencias();
    await prefs.setString(claveSesion, jsonEncode(sesion.toJson()));
  }

  Future<void> cerrarSesion() async {
    final prefs = await _obtenerPreferencias();
    await prefs.remove(claveSesion);
  }
}
