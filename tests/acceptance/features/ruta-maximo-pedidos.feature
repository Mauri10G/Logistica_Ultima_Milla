# language: es
Característica: Armado de rutas
  Para que ningún repartidor se sobrecargue
  Como personal del negocio
  Quiero que cada ruta respete el máximo de pedidos configurado

  Escenario: CP-09 Armar automáticamente una ruta respetando el máximo de pedidos
    Dado que existen 9 pedidos pendientes en la zona "Centro" para una fecha futura
    Cuando el personal arma las rutas de esa fecha desde la web
    Entonces ninguna ruta tiene más de 4 pedidos
    Y se crearon 3 rutas
    Y los 9 pedidos quedaron repartidos entre las rutas
    Y el sistema asignó los 9 pedidos y cada uno está en una sola ruta
