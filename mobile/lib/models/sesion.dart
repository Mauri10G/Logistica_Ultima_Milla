/// Sesion autenticada devuelta por POST /api/auth/login.
class Sesion {
  final String token;
  final String rol;
  final int? repartidorId;

  const Sesion({
    required this.token,
    required this.rol,
    this.repartidorId,
  });

  /// Solo cuentas COURIER con repartidorId valido pueden operar la app movil.
  bool get esRepartidor => rol.toUpperCase() == 'COURIER' && repartidorId != null && repartidorId! > 0;

  factory Sesion.fromJson(Map<String, dynamic> json) {
    return Sesion(
      token: json['token'] as String? ?? '',
      rol: json['rol'] as String? ?? '',
      repartidorId: (json['repartidorId'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() => {
        'token': token,
        'rol': rol,
        'repartidorId': repartidorId,
      };
}
