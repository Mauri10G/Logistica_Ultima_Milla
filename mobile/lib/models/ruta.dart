import 'pedido.dart';

/// Ruta de un repartidor con sus pedidos en orden de visita (RutaResponse).
class Ruta {
  final int id;
  final String fecha;
  final String zonaNombre;
  final String repartidorNombre;
  final String estado;
  final int maxPedidos;
  final List<Pedido> pedidos;

  const Ruta({
    required this.id,
    required this.fecha,
    required this.zonaNombre,
    required this.repartidorNombre,
    required this.estado,
    required this.maxPedidos,
    required this.pedidos,
  });

  factory Ruta.fromJson(Map<String, dynamic> json) {
    final pedidos = (json['pedidos'] as List<dynamic>? ?? [])
        .map((p) => Pedido.fromJson(p as Map<String, dynamic>))
        .toList()
      ..sort((a, b) => (a.ordenEnRuta ?? 1 << 30).compareTo(b.ordenEnRuta ?? 1 << 30));
    return Ruta(
      id: json['id'] as int,
      fecha: json['fecha'] as String? ?? '',
      zonaNombre: json['zonaNombre'] as String? ?? '',
      repartidorNombre: json['repartidorNombre'] as String? ?? '',
      estado: json['estado'] as String? ?? '',
      maxPedidos: json['maxPedidos'] as int? ?? 0,
      pedidos: pedidos,
    );
  }
}
