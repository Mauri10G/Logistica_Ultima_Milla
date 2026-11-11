/// Pedido tal como lo devuelve la API (PedidoResponse).
class Pedido {
  final int id;
  final String clienteNombres;
  final String clienteTelefono;
  final String direccion;
  final String horaEntrega;
  final String prioridad;
  final String estado;
  final int? ordenEnRuta;
  final double latitud;
  final double longitud;

  const Pedido({
    required this.id,
    required this.clienteNombres,
    required this.clienteTelefono,
    required this.direccion,
    required this.horaEntrega,
    required this.estado,
    required this.latitud,
    required this.longitud,
    this.prioridad = 'NORMAL',
    this.ordenEnRuta,
  });

  factory Pedido.fromJson(Map<String, dynamic> json) {
    return Pedido(
      id: json['id'] as int,
      clienteNombres: json['clienteNombres'] as String? ?? '',
      clienteTelefono: json['clienteTelefono'] as String? ?? '',
      direccion: json['direccion'] as String? ?? '',
      horaEntrega: json['horaEntrega'] as String? ?? '',
      prioridad: json['prioridad'] as String? ?? 'NORMAL',
      estado: json['estado'] as String,
      ordenEnRuta: json['ordenEnRuta'] as int?,
      latitud: (json['latitud'] as num?)?.toDouble() ?? 0,
      longitud: (json['longitud'] as num?)?.toDouble() ?? 0,
    );
  }

  /// URI de Google Maps usando coordenadas si existen o la direccion como respaldo.
  Uri get uriGoogleMaps {
    final consulta = (latitud != 0 || longitud != 0) ? '$latitud,$longitud' : direccion;
    return Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': consulta});
  }

  /// Flujo lineal del backend: PENDIENTE -> ASIGNADO -> RECOGIDO -> EN_CAMINO -> ENTREGADO.
  /// El repartidor solo avanza desde ASIGNADO; devuelve null si no hay paso siguiente para el.
  String? get siguienteEstado {
    switch (estado) {
      case 'ASIGNADO':
        return 'RECOGIDO';
      case 'RECOGIDO':
        return 'EN_CAMINO';
      case 'EN_CAMINO':
        return 'ENTREGADO';
      default:
        return null;
    }
  }

  /// Texto del boton que avanza el pedido al siguiente estado.
  String? get textoAccion {
    switch (siguienteEstado) {
      case 'RECOGIDO':
        return 'Marcar como recogido';
      case 'EN_CAMINO':
        return 'Marcar en camino';
      case 'ENTREGADO':
        return 'Marcar como entregado';
      default:
        return null;
    }
  }

  /// "10:30:00" -> "10:30"
  String get horaCorta => horaEntrega.length >= 5 ? horaEntrega.substring(0, 5) : horaEntrega;
}
