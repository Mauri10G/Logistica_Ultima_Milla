import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'config.dart';
import 'models/sesion.dart';
import 'screens/login_screen.dart';
import 'screens/ruta_screen.dart';
import 'screens/seleccion_repartidor_screen.dart';
import 'services/api_service.dart';
import 'services/sesion_service.dart';
import 'services/stomp_service.dart';

void main() {
  runApp(const LogisticaApp());
}

class LogisticaApp extends StatefulWidget {
  final SesionService? sesionService;
  final ApiService? api;
  final http.Client? clienteHttp;
  final String? urlBase;
  final StompService? stomp;
  final Future<bool> Function(Uri uri)? lanzarUrl;
  final bool habilitaAuth;
  final bool permiteIdTemporal;

  const LogisticaApp({
    super.key,
    this.sesionService,
    this.api,
    this.clienteHttp,
    this.urlBase,
    this.stomp,
    this.lanzarUrl,
    this.habilitaAuth = authHabilitada,
    this.permiteIdTemporal = permitirIdTemporal,
  });

  @override
  State<LogisticaApp> createState() => _LogisticaAppState();
}

class _LogisticaAppState extends State<LogisticaApp> {
  late final SesionService _sesionService = widget.sesionService ?? SesionService();
  late final ApiService _api = widget.api ??
      ApiService(
        cliente: widget.clienteHttp,
        urlBase: widget.urlBase,
        obtenerToken: () => _sesion?.token,
        alExpirarSesion: () => _cerrarSesion(expirada: true),
      );

  Sesion? _sesion;
  bool _cargandoSesion = true;
  String? _mensajeLogin;

  @override
  void initState() {
    super.initState();
    if (!widget.habilitaAuth) {
      _cargandoSesion = false;
      return;
    }
    _cargarSesion();
  }

  Future<void> _cargarSesion() async {
    final guardada = await _sesionService.obtenerSesion();
    if (!mounted) return;
    setState(() {
      _sesion = (guardada != null && guardada.esRepartidor) ? guardada : null;
      _cargandoSesion = false;
    });
  }

  Future<void> _iniciarSesion(Sesion sesion) async {
    await _sesionService.guardarSesion(sesion);
    if (!mounted) return;
    setState(() {
      _sesion = sesion;
      _mensajeLogin = null;
    });
  }

  Future<void> _cerrarSesion({bool expirada = false}) async {
    await _sesionService.cerrarSesion();
    if (!mounted) return;
    setState(() {
      _sesion = null;
      _mensajeLogin = expirada ? 'Tu sesión expiró. Inicia sesión nuevamente.' : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Repartidor - Logística',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: _construirInicio(),
    );
  }

  Widget _construirInicio() {
    if (!widget.habilitaAuth) {
      return SeleccionRepartidorScreen(api: widget.api, stomp: widget.stomp);
    }
    if (_cargandoSesion) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final sesion = _sesion;
    if (sesion != null && sesion.esRepartidor) {
      return RutaScreen(
        key: ValueKey('ruta-${sesion.repartidorId}-${sesion.token}'),
        repartidorId: sesion.repartidorId!,
        token: sesion.token,
        api: _api,
        stomp: widget.stomp,
        lanzarUrl: widget.lanzarUrl,
        alCerrarSesion: () => _cerrarSesion(),
      );
    }
    return LoginScreen(
      api: _api,
      sesionService: _sesionService,
      stomp: widget.stomp,
      alIniciarSesion: _iniciarSesion,
      permitirAccesoPorId: widget.permiteIdTemporal,
      mensajeInicial: _mensajeLogin,
    );
  }
}
