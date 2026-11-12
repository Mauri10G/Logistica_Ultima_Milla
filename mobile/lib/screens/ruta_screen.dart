import 'package:flutter/material.dart';

import '../models/pedido.dart';
import '../models/ruta.dart';
import '../services/api_service.dart';
import '../services/stomp_service.dart';
import '../widgets/pedido_tile.dart';

/// Ruta del repartidor con sus pedidos en orden de entrega.
class RutaScreen extends StatefulWidget {
  final int repartidorId;
  final String? token;
  final ApiService? api;
  final StompService? stomp;
  final Future<bool> Function(Uri uri)? lanzarUrl;
  final Future<void> Function()? alCerrarSesion;

  const RutaScreen({
    super.key,
    required this.repartidorId,
    this.token,
    this.api,
    this.stomp,
    this.lanzarUrl,
    this.alCerrarSesion,
  });

  @override
  State<RutaScreen> createState() => _RutaScreenState();
}

class _RutaScreenState extends State<RutaScreen> {
  late final ApiService _api = widget.api ?? ApiService(token: widget.token);
  StompService? _stomp;
  Ruta? _ruta;
  bool _sinRuta = false;
  String? _error;
  bool _cargando = true;
  bool _tiempoRealConectado = false;
  int? _pedidoProcesandoId;

  @override
  void initState() {
    super.initState();
    _cargar();
    _stomp = widget.stomp ?? StompService();
    _stomp!.conectar(
      token: widget.token,
      alCambiarRutas: () => _cargar(desdeTiempoReal: true),
      alCambiarConexion: (conectado) {
        if (!mounted) return;
        setState(() => _tiempoRealConectado = conectado);
      },
    );
  }

  @override
  void dispose() {
    _stomp?.desconectar();
    super.dispose();
  }

  Future<void> _cargar({bool desdeTiempoReal = false}) async {
    try {
      final ruta = await _api.obtenerRutaActual(widget.repartidorId);
      if (!mounted) return;
      final cambioEnRuta = desdeTiempoReal &&
          _ruta != null &&
          (ruta.id != _ruta!.id || ruta.pedidos.length != _ruta!.pedidos.length);
      setState(() {
        _ruta = ruta;
        _sinRuta = false;
        _error = null;
        _cargando = false;
      });
      if (cambioEnRuta) {
        _mostrarMensaje('Tu ruta fue actualizada');
      }
    } on SinRutaException {
      if (!mounted) return;
      setState(() {
        _ruta = null;
        _sinRuta = true;
        _error = null;
        _cargando = false;
      });
    } on SinConexionException catch (e) {
      _manejarErrorCarga(e.mensaje);
    } on ApiException catch (e) {
      _manejarErrorCarga(e.mensajeUsuario);
    } catch (_) {
      _manejarErrorCarga('No se pudo cargar la ruta. Intenta nuevamente.');
    }
  }

  void _mostrarMensaje(String mensaje) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(mensaje)));
  }

  void _manejarErrorCarga(String mensaje) {
    if (!mounted) return;
    if (_ruta != null) {
      setState(() => _cargando = false);
      _mostrarMensaje(mensaje);
      return;
    }
    setState(() {
      _sinRuta = false;
      _error = mensaje;
      _cargando = false;
    });
  }

  Future<void> _cambiarEstado(Pedido pedido, String nuevoEstado) async {
    if (nuevoEstado == 'ENTREGADO') {
      final confirmado = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Confirmar entrega'),
          content: Text(
            '¿Confirmas que el pedido de ${pedido.clienteNombres} (${pedido.direccion}) fue entregado?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Confirmar'),
            ),
          ],
        ),
      );
      if (confirmado != true || !mounted) return;
    }

    setState(() => _pedidoProcesandoId = pedido.id);
    try {
      await _api.cambiarEstado(pedido.id, nuevoEstado);
      await _cargar();
    } on SinConexionException catch (e) {
      if (!mounted) return;
      _mostrarMensaje(e.mensaje);
    } on ApiException catch (e) {
      if (!mounted) return;
      _mostrarMensaje(e.mensajeUsuario);
    } catch (_) {
      if (!mounted) return;
      _mostrarMensaje('No se pudo actualizar el estado del pedido.');
    } finally {
      if (mounted) {
        setState(() => _pedidoProcesandoId = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ruta = _ruta;
    return Scaffold(
      appBar: AppBar(
        title: Text('Mi ruta · repartidor ${widget.repartidorId}'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Tooltip(
              message: _tiempoRealConectado ? 'Tiempo real conectado' : 'Tiempo real desconectado',
              child: Icon(
                _tiempoRealConectado ? Icons.wifi : Icons.wifi_off,
                size: 20,
                color: _tiempoRealConectado ? Colors.green : Colors.grey,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Recargar ruta',
            onPressed: _cargando ? null : _cargar,
          ),
          if (widget.alCerrarSesion != null)
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'Cerrar sesión',
              onPressed: () async {
                _stomp?.desconectar();
                await widget.alCerrarSesion!();
              },
            ),
        ],
      ),
      body: _cargando
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _cargar,
              child: _construirCuerpo(context, ruta),
            ),
    );
  }

  Widget _construirCuerpo(BuildContext context, Ruta? ruta) {
    if (_sinRuta) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 48),
          Icon(Icons.local_shipping_outlined, size: 64, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 16),
          Text(
            'No tienes una ruta asignada',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          const Text(
            'Desliza hacia abajo para recargar o espera a que se arme una nueva ruta.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          Center(
            child: FilledButton.icon(
              onPressed: _cargar,
              icon: const Icon(Icons.refresh),
              label: const Text('Recargar'),
            ),
          ),
        ],
      );
    }

    if (ruta == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 48),
          const Icon(Icons.error_outline, size: 64, color: Colors.redAccent),
          const SizedBox(height: 16),
          Text(
            _error ?? 'No se pudo cargar la ruta.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 20),
          Center(
            child: FilledButton.icon(
              onPressed: _cargar,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text(
            'Ruta ${ruta.id} · ${ruta.zonaNombre} · ${ruta.fecha} · ${ruta.estado} (${ruta.pedidos.length} paradas)',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        for (final pedido in ruta.pedidos)
          PedidoTile(
            pedido: pedido,
            procesando: _pedidoProcesandoId == pedido.id,
            lanzarUrl: widget.lanzarUrl,
            alCambiarEstado: (nuevo) => _cambiarEstado(pedido, nuevo),
          ),
      ],
    );
  }
}
