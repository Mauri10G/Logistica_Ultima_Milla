# language: es
Característica: Gestión de repartidores
  Para poder asignarles rutas
  Como personal del negocio
  Quiero registrar repartidores y controlar su disponibilidad

  Escenario: CP-10 Registrar un nuevo repartidor y su disponibilidad
    Dado que el personal abre la pantalla de "Repartidores"
    Cuando pulsa el botón "Nuevo repartidor"
    Y escribe el nombre del repartidor de la prueba
    Y escribe "0998877665" en el teléfono del repartidor
    Y pulsa el botón "Agregar repartidor"
    Entonces ve el aviso de que el repartidor de la prueba fue agregado
    Cuando busca al repartidor de la prueba
    Entonces ve al repartidor de la prueba en la tabla con teléfono "0998877665"
    Y el interruptor de disponibilidad del repartidor de la prueba está "encendido"
    Y el sistema guardó al repartidor de la prueba como disponible "sí"
    Cuando apaga la disponibilidad del repartidor de la prueba
    Entonces el interruptor de disponibilidad del repartidor de la prueba está "apagado"
    Y el sistema guardó al repartidor de la prueba como disponible "no"
