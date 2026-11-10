import 'package:flutter/material.dart';

import '../models/ruta.dart';
import '../services/api_service.dart';
import '../services/stomp_service.dart';
import '../widgets/pedido_tile.dart';

/// Ruta del repartidor con sus pedidos en orden de entrega.
class RutaScreen extends StatefulWidget {
  final int repartidorId;
  final ApiService? api;
  final StompService? stomp;

  const RutaScreen({super.key, required this.repartidorId, this.api, this.stomp});

  @override
  State<RutaScreen> createState() => _RutaScreenState();
}

class _RutaScreenState extends State<RutaScreen> {
  late final ApiService _api = widget.api ?? ApiService();
  StompService? _stomp;
  Ruta? _ruta;
  String? _error;
  bool _cargando = true;

  @override
  void initState() {
    super.initState();
    _cargar();
    _stomp = widget.stomp ?? StompService();
    _stomp!.conectar(alCambiarRutas: _cargar);
  }

  @override
  void dispose() {
    _stomp?.desconectar();
    super.dispose();
  }

  Future<void> _cargar() async {
    try {
      final ruta = await _api.obtenerRutaActual(widget.repartidorId);
      if (!mounted) return;
      setState(() {
        _ruta = ruta;
        _error = null;
        _cargando = false;
      });
    } on SinRutaException catch (e) {
      if (!mounted) return;
      setState(() {
        _ruta = null;
        _error = e.toString();
        _cargando = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudo cargar la ruta: $e';
        _cargando = false;
      });
    }
  }

  Future<void> _cambiarEstado(int pedidoId, String nuevoEstado) async {
    try {
      await _api.cambiarEstado(pedidoId, nuevoEstado);
      await _cargar();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final ruta = _ruta;
    return Scaffold(
      appBar: AppBar(title: Text('Mi ruta · repartidor ${widget.repartidorId}')),
      body: RefreshIndicator(
        onRefresh: _cargar,
        child: _cargando
            ? const Center(child: CircularProgressIndicator())
            : ruta == null
                ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(_error ?? 'Sin ruta'))])
                : ListView(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          'Ruta ${ruta.id} · ${ruta.zonaNombre} · ${ruta.fecha} · ${ruta.estado}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      for (final pedido in ruta.pedidos)
                        PedidoTile(
                          pedido: pedido,
                          alCambiarEstado: (nuevo) => _cambiarEstado(pedido.id, nuevo),
                        ),
                    ],
                  ),
      ),
    );
  }
}
