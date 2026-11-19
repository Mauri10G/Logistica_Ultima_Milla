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

  const LogisticaApp({
    super.key,
    this.sesionService,
    this.api,
    this.clienteHttp,
    this.urlBase,
    this.stomp,
    this.lanzarUrl,
    this.habilitaAuth = authHabilitada,
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
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E3A8A),
          brightness: Brightness.light,
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 1,
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F172A),
        ),
        cardTheme: CardThemeData(
          elevation: 1.5,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          color: Colors.white,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          ),
        ),
      ),
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
      mensajeInicial: _mensajeLogin,
    );
  }
}
