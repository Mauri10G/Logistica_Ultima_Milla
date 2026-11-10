import 'package:flutter/material.dart';

import 'screens/seleccion_repartidor_screen.dart';

void main() {
  runApp(const LogisticaApp());
}

class LogisticaApp extends StatelessWidget {
  const LogisticaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Repartidor - Logística',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const SeleccionRepartidorScreen(),
    );
  }
}
