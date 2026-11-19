import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/pedido.dart';

/// Tarjeta de un pedido dentro de la ruta. El boton avanza el pedido al siguiente estado
/// (recogido -> en camino -> entregado) y desaparece cuando ya esta ENTREGADO.
class PedidoTile extends StatelessWidget {
  final Pedido pedido;
  final Future<void> Function(String nuevoEstado)? alCambiarEstado;
  final Future<bool> Function(Uri uri)? lanzarUrl;
  final bool procesando;

  const PedidoTile({
    super.key,
    required this.pedido,
    this.alCambiarEstado,
    this.lanzarUrl,
    this.procesando = false,
  });

  Future<void> _abrirEnMaps(BuildContext context) async {
    final lanzador = lanzarUrl ?? (uri) => launchUrl(uri, mode: LaunchMode.externalApplication);
    var abierto = false;
    try {
      abierto = await lanzador(pedido.uriGoogleMaps);
    } catch (_) {
      abierto = false;
    }
    if (!abierto && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir Google Maps')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final siguiente = pedido.siguienteEstado;
    final entregado = pedido.estado == 'ENTREGADO';
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Cabecera: Número de orden, Dirección y Chip de Estado
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 15,
                  backgroundColor: theme.colorScheme.primaryContainer,
                  foregroundColor: theme.colorScheme.onPrimaryContainer,
                  child: Text(
                    '${pedido.ordenEnRuta ?? '-'}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    pedido.direccion,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      height: 1.25,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _ChipEstado(estado: pedido.estado),
              ],
            ),
            const SizedBox(height: 12),

            // Información del Cliente
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.person_outline, size: 16, color: Colors.grey.shade700),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Cliente: ${pedido.clienteNombres} · ${pedido.clienteTelefono}',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade800,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 12,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.schedule_outlined, size: 15, color: Colors.grey.shade700),
                          const SizedBox(width: 4),
                          Text(
                            'Hora aproximada: ${pedido.horaCorta}',
                            style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                          ),
                        ],
                      ),
                      _EtiquetaPrioridad(prioridad: pedido.prioridad),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Acciones: Maps y Avance de Estado con ajuste responsivo
            LayoutBuilder(
              builder: (context, constraints) {
                final accionIcono = switch (siguiente) {
                  'RECOGIDO' => Icons.inventory_2_outlined,
                  'EN_CAMINO' => Icons.local_shipping_outlined,
                  'ENTREGADO' => Icons.check_circle_outline,
                  _ => Icons.arrow_forward,
                };

                return Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _abrirEnMaps(context),
                      icon: const Icon(Icons.map_outlined, size: 18),
                      label: const Text('Abrir en Maps'),
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    if (entregado)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.green.shade50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.green.shade200),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle, size: 18, color: Colors.green.shade700),
                            const SizedBox(width: 6),
                            Text(
                              'Entregado',
                              style: TextStyle(
                                color: Colors.green.shade800,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      )
                    else if (siguiente != null && alCambiarEstado != null)
                      FilledButton.icon(
                        onPressed: procesando ? null : () => alCambiarEstado!(siguiente),
                        icon: procesando
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Icon(accionIcono, size: 18),
                        label: Text(pedido.textoAccion!),
                        style: FilledButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ChipEstado extends StatelessWidget {
  final String estado;

  const _ChipEstado({required this.estado});

  @override
  Widget build(BuildContext context) {
    final (Color fondo, Color texto, Color borde) = switch (estado.toUpperCase()) {
      'ENTREGADO' => (const Color(0xFFDCFCE7), const Color(0xFF15803D), const Color(0xFFBBF7D0)),
      'EN_CAMINO' => (const Color(0xFFF3E8FF), const Color(0xFF7E22CE), const Color(0xFFE9D5FF)),
      'RECOGIDO' => (const Color(0xFFFEF3C7), const Color(0xFFB45309), const Color(0xFFFDE68A)),
      _ => (const Color(0xFFEFF6FF), const Color(0xFF1D4ED8), const Color(0xFFBFDBFE)), // ASIGNADO
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borde),
      ),
      child: Text(
        estado,
        style: TextStyle(
          color: texto,
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _EtiquetaPrioridad extends StatelessWidget {
  final String prioridad;

  const _EtiquetaPrioridad({required this.prioridad});

  @override
  Widget build(BuildContext context) {
    final (Color fondo, Color texto, IconData? icono) = switch (prioridad.toUpperCase()) {
      'URGENTE' => (Colors.red.shade100, Colors.red.shade900, Icons.priority_high),
      'ALTA' => (Colors.orange.shade100, Colors.orange.shade900, Icons.arrow_upward),
      _ => (Colors.blueGrey.shade50, Colors.blueGrey.shade800, null),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icono != null) ...[
            Icon(icono, size: 14, color: texto),
            const SizedBox(width: 3),
          ],
          Text(
            'Prioridad: $prioridad',
            style: TextStyle(color: texto, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
