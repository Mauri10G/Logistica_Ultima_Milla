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

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(radius: 14, child: Text('${pedido.ordenEnRuta ?? '-'}')),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    pedido.direccion,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Chip(label: Text(pedido.estado), visualDensity: VisualDensity.compact),
              ],
            ),
            const SizedBox(height: 6),
            Text('Cliente: ${pedido.clienteNombres} · ${pedido.clienteTelefono}'),
            const SizedBox(height: 4),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('Hora aproximada: ${pedido.horaCorta}'),
                _EtiquetaPrioridad(prioridad: pedido.prioridad),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                OutlinedButton.icon(
                  onPressed: () => _abrirEnMaps(context),
                  icon: const Icon(Icons.map_outlined, size: 18),
                  label: const Text('Abrir en Maps'),
                ),
                if (entregado)
                  const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle, color: Colors.green),
                      SizedBox(width: 6),
                      Text('Entregado'),
                    ],
                  )
                else if (siguiente != null && alCambiarEstado != null)
                  FilledButton(
                    onPressed: procesando ? null : () => alCambiarEstado!(siguiente),
                    child: procesando
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Text(pedido.textoAccion!),
                  ),
              ],
            ),
          ],
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
