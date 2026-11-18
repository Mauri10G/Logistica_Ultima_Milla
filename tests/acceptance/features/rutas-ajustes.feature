# language: es
Característica: Ajustes manuales de rutas
  Para corregir una ruta armada antes de que salga el repartidor
  Como personal del negocio
  Quiero subir, bajar, sacar y mover pedidos y cambiar el repartidor de una ruta

  Antecedentes:
    Dado que el personal inició sesión

  Escenario: Subir y bajar la parada de un pedido dentro de una ruta
    Dado que existen 3 pedidos pendientes en la zona "Centro" para una fecha futura
    Y que las rutas de esa fecha ya están armadas
    Y que el personal abre la pantalla de Rutas con las rutas de esa fecha
    Cuando pulsa Ajustar ruta en la primera ruta
    Y baja la parada del primer pedido de la primera ruta
    Entonces ve que el orden de las paradas cambió

  Escenario: Sacar un pedido de una ruta lo devuelve a PENDIENTE
    Dado que existen 3 pedidos pendientes en la zona "Centro" para una fecha futura
    Y que las rutas de esa fecha ya están armadas
    Y que el personal abre la pantalla de Rutas con las rutas de esa fecha
    Cuando pulsa Ajustar ruta en la primera ruta
    Y saca el primer pedido de la primera ruta
    Y pulsa "Sacar pedido" en el diálogo de confirmación
    Entonces el pedido sacado vuelve a PENDIENTE sin ruta

  Escenario: Mover un pedido a otra ruta de la misma fecha
    Dado que existen 5 pedidos pendientes en la zona "Centro" para una fecha futura
    Y que las rutas de esa fecha ya están armadas
    Y que el personal abre la pantalla de Rutas con las rutas de esa fecha
    Cuando pulsa Ajustar ruta en la primera ruta
    Y mueve el primer pedido de la primera ruta a la segunda ruta
    Y pulsa "Mover pedido" en el diálogo de confirmación
    Entonces el pedido movido queda en la segunda ruta

  Escenario: Cambiar el repartidor de una ruta armada
    Dado que existen 3 pedidos pendientes en la zona "Centro" para una fecha futura
    Y que las rutas de esa fecha ya están armadas
    Y que el personal abre la pantalla de Rutas con las rutas de esa fecha
    Cuando pulsa Ajustar ruta en la primera ruta
    Y cambia el repartidor de la primera ruta
    Entonces la ruta tiene otro repartidor
