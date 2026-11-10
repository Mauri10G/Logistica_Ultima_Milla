import 'package:flutter/material.dart';

import '../models/pedido.dart';

/// Tarjeta de un pedido dentro de la ruta. El boton avanza el pedido al siguiente estado
/// (recogido -> en camino -> entregado) y desaparece cuando ya esta ENTREGADO.
class PedidoTile extends StatelessWidget {
  final Pedido pedido;
  final Future<void> Function(String nuevoEstado)? alCambiarEstado;

  const PedidoTile({super.key, required this.pedido, this.alCambiarEstado});

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
            Text('Hora aproximada: ${pedido.horaCorta}'),
            const SizedBox(height: 8),
            if (entregado)
              const Row(children: [Icon(Icons.check_circle, color: Colors.green), SizedBox(width: 6), Text('Entregado')])
            else if (siguiente != null && alCambiarEstado != null)
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton(
                  onPressed: () => alCambiarEstado!(siguiente),
                  child: Text(pedido.textoAccion!),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
