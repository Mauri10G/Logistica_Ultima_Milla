import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'ruta_screen.dart';

/// No hay login todavia: el repartidor se identifica indicando su id.
class SeleccionRepartidorScreen extends StatefulWidget {
  final ApiService? api;

  const SeleccionRepartidorScreen({super.key, this.api});

  @override
  State<SeleccionRepartidorScreen> createState() => _SeleccionRepartidorScreenState();
}

class _SeleccionRepartidorScreenState extends State<SeleccionRepartidorScreen> {
  final _controlador = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controlador.dispose();
    super.dispose();
  }

  void _verRuta() {
    final id = int.tryParse(_controlador.text.trim());
    if (id == null || id <= 0) {
      setState(() => _error = 'Ingrese un id de repartidor valido');
      return;
    }
    setState(() => _error = null);
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => RutaScreen(repartidorId: id, api: widget.api)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Repartidor')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Seleccione su repartidor', style: TextStyle(fontSize: 18)),
            const SizedBox(height: 16),
            TextField(
              controller: _controlador,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'ID del repartidor',
                border: const OutlineInputBorder(),
                errorText: _error,
              ),
              onSubmitted: (_) => _verRuta(),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: _verRuta, child: const Text('Ver mi ruta')),
          ],
        ),
      ),
    );
  }
}
