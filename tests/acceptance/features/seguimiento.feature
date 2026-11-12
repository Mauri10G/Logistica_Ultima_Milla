# language: es
Característica: Seguimiento de entregas en tiempo real
  Para saber en qué punto está cada entrega sin tener que recargar
  Como personal del negocio
  Quiero ver en Seguimiento los cambios de estado que hace el repartidor desde la app móvil

  Escenario: CP-11 Marcar un pedido como entregado y verificar reflejo inmediato en la web
    Dado que existe un pedido del cliente de la prueba en la zona "Centro" para una fecha futura
    Y que el repartidor ya recogió el pedido y va en camino
    Y que el personal tiene abierto Seguimiento con la fecha de ese pedido
    Cuando el repartidor marca el pedido como ENTREGADO desde la app móvil
    Entonces Seguimiento muestra el pedido como "Entregado" sin recargar la página
    Y la pastilla "Entregado" de Seguimiento cuenta 1 pedido
    Cuando abre el historial del pedido en Seguimiento
    Entonces el historial registra el cambio a "Entregado" hecho desde el móvil
