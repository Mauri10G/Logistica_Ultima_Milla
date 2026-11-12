import 'package:flutter/material.dart';

import '../config.dart';
import '../models/sesion.dart';
import '../services/api_service.dart';
import '../services/sesion_service.dart';
import '../services/stomp_service.dart';
import 'ruta_screen.dart';
import 'seleccion_repartidor_screen.dart';

/// Pantalla de autenticacion del repartidor contra POST /api/auth/login.
class LoginScreen extends StatefulWidget {
  final ApiService? api;
  final SesionService? sesionService;
  final StompService? stomp;
  final Future<void> Function(Sesion sesion)? alIniciarSesion;
  final bool permitirAccesoPorId;
  final String? mensajeInicial;

  const LoginScreen({
    super.key,
    this.api,
    this.sesionService,
    this.stomp,
    this.alIniciarSesion,
    this.permitirAccesoPorId = permitirIdTemporal,
    this.mensajeInicial,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usuarioCtrl = TextEditingController();
  final _claveCtrl = TextEditingController();

  late final ApiService _api = widget.api ?? ApiService();
  late final SesionService _sesionService = widget.sesionService ?? SesionService();

  bool _ocultarClave = true;
  bool _enviando = false;
  late String? _error = widget.mensajeInicial;

  @override
  void didUpdateWidget(covariant LoginScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.mensajeInicial != null && widget.mensajeInicial != oldWidget.mensajeInicial) {
      _error = widget.mensajeInicial;
    }
  }

  @override
  void dispose() {
    _usuarioCtrl.dispose();
    _claveCtrl.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _enviando = true;
      _error = null;
    });

    try {
      final sesion = await _api.iniciarSesion(_usuarioCtrl.text.trim(), _claveCtrl.text);
      if (!sesion.esRepartidor) {
        if (!mounted) return;
        setState(() {
          _error = 'Esta cuenta no corresponde a un repartidor.';
          _enviando = false;
        });
        return;
      }

      if (widget.alIniciarSesion != null) {
        await widget.alIniciarSesion!(sesion);
      } else {
        await _sesionService.guardarSesion(sesion);
        if (!mounted) return;
        final apiConToken = widget.api ?? ApiService(token: sesion.token);
        await Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => RutaScreen(
              repartidorId: sesion.repartidorId!,
              token: sesion.token,
              api: apiConToken,
              stomp: widget.stomp,
              alCerrarSesion: () async {
                await _sesionService.cerrarSesion();
              },
            ),
          ),
        );
      }
    } on SinConexionException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.mensaje);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.status == 401 ? e.mensaje : e.mensajeUsuario);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo iniciar sesión. Intenta nuevamente.');
    } finally {
      if (mounted) {
        setState(() => _enviando = false);
      }
    }
  }

  void _abrirAccesoPorId() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SeleccionRepartidorScreen(api: _api, stomp: widget.stomp),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Entregas y Rutas')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.local_shipping_outlined, size: 56, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 12),
                  Text(
                    'Ingreso de repartidor',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Ingresa con tu usuario asignado para ver tu ruta del día.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    key: const Key('campoUsuario'),
                    controller: _usuarioCtrl,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.username],
                    decoration: const InputDecoration(
                      labelText: 'Usuario',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    validator: (valor) {
                      if (valor == null || valor.trim().isEmpty) {
                        return 'Ingrese su usuario';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    key: const Key('campoClave'),
                    controller: _claveCtrl,
                    obscureText: _ocultarClave,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.password],
                    onFieldSubmitted: (_) => _enviando ? null : _enviar(),
                    decoration: InputDecoration(
                      labelText: 'Clave',
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_ocultarClave ? Icons.visibility : Icons.visibility_off),
                        tooltip: _ocultarClave ? 'Mostrar clave' : 'Ocultar clave',
                        onPressed: () => setState(() => _ocultarClave = !_ocultarClave),
                      ),
                    ),
                    validator: (valor) {
                      if (valor == null || valor.isEmpty) {
                        return 'Ingrese su clave';
                      }
                      return null;
                    },
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: Colors.red.shade700),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: TextStyle(color: Colors.red.shade900),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    key: const Key('botonIngresar'),
                    onPressed: _enviando ? null : _enviar,
                    child: _enviando
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Ingresar'),
                  ),
                  if (widget.permitirAccesoPorId) ...[
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _enviando ? null : _abrirAccesoPorId,
                      child: const Text('Ingresar por ID (temporal)'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
