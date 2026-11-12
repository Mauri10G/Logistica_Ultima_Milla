# language: es
Característica: Registro de pedidos
  Para que cada entrega quede programada en la zona correcta
  Como personal del negocio
  Quiero registrar y editar pedidos desde la web

  Escenario: CP-01 Registrar un pedido nuevo con datos completos
    Dado que el personal abre la pantalla de "Pedidos"
    Cuando pulsa el botón "Nuevo pedido"
    Y escribe el nombre del cliente de la prueba
    Y escribe "0991234567" en el teléfono del cliente
    Y escribe "cliente.prueba@correo.com" en el email del cliente
    Y escribe "Av. Cevallos y Montalvo, frente al parque" en la dirección de entrega
    Y hace clic en el mapa en la latitud -1.2412 y longitud -78.6150
    Y elige la fecha de entrega "mañana"
    Y escribe "10:30" en la hora de entrega
    Y elige la prioridad "Alta"
    Y pulsa el botón "Registrar pedido"
    Entonces ve el aviso "Pedido registrado."
    Y el sistema guardó el pedido del cliente de la prueba como "PENDIENTE" en la zona "Centro"
    Y el pedido de la prueba tiene prioridad "ALTA"
    Cuando pulsa el botón "Mañana"
    Y busca al cliente de la prueba en la lista de pedidos
    Entonces ve al cliente de la prueba en la lista con estado "Pendiente" y zona "Centro"
    Cuando abre el detalle del pedido del cliente de la prueba
    Entonces el detalle del pedido muestra "Av. Cevallos y Montalvo, frente al parque"
    Y el detalle del pedido muestra "0991234567"
    Y el detalle del pedido muestra "Alta"

  Escenario: CP-02 Registrar un pedido en nombre del cliente por el personal del negocio
    Dado que el personal abre la pantalla de "Pedidos"
    Cuando pulsa el botón "Nuevo pedido"
    Y escribe el nombre del cliente de la prueba
    Y escribe "0987654321" en el teléfono del cliente
    Y escribe "Calle Bolívar y Sucre, casa azul de dos pisos" en la dirección de entrega
    Y hace clic en el mapa en la latitud -1.2412 y longitud -78.6150
    Y elige la fecha de entrega "mañana"
    Y escribe "15:00" en la hora de entrega
    Y pulsa el botón "Registrar pedido"
    Entonces ve el aviso "Pedido registrado."
    Y el sistema guardó el pedido del cliente de la prueba como "PENDIENTE" en la zona "Centro"
    Y el pedido de la prueba quedó registrado por el personal del negocio
    Cuando pulsa el botón "Mañana"
    Y busca al cliente de la prueba en la lista de pedidos
    Entonces ve al cliente de la prueba en la lista con estado "Pendiente" y zona "Centro"

  Escenario: CP-03 Intentar registrar un pedido con dirección fuera de las zonas configuradas
    Dado que el personal abre la pantalla de "Pedidos"
    Cuando pulsa el botón "Nuevo pedido"
    Y escribe el nombre del cliente de la prueba
    Y escribe "0991234567" en el teléfono del cliente
    Y escribe "Camino rural sin nombre, fuera de la ciudad" en la dirección de entrega
    Y hace clic en el mapa en la latitud -1.2491 y longitud -78.6650
    Y elige la fecha de entrega "mañana"
    Y escribe "10:30" en la hora de entrega
    Y pulsa el botón "Registrar pedido"
    Entonces ve el mensaje de error "La dirección no corresponde a ninguna zona configurada"
    Y el sistema no registró ningún pedido del cliente de la prueba

  Escenario: CP-04 Intentar registrar un pedido con fecha de entrega anterior a la fecha actual
    Dado que el personal abre la pantalla de "Pedidos"
    Cuando pulsa el botón "Nuevo pedido"
    Y escribe el nombre del cliente de la prueba
    Y escribe "0991234567" en el teléfono del cliente
    Y escribe "Av. Cevallos y Montalvo, frente al parque" en la dirección de entrega
    Y hace clic en el mapa en la latitud -1.2412 y longitud -78.6150
    Y elige la fecha de entrega "ayer"
    Y escribe "10:30" en la hora de entrega
    Entonces ve el aviso de fecha "La fecha de entrega no puede ser anterior a hoy" bajo el campo de fecha de entrega
    Cuando pulsa el botón "Registrar pedido"
    Entonces el sistema no registró ningún pedido del cliente de la prueba

  Escenario: CP-05 Editar los datos de un pedido ya registrado antes del armado de su ruta
    Dado que existe un pedido pendiente del cliente de la prueba en la zona "Centro" para mañana
    Y que el personal abre la pantalla de "Pedidos"
    Cuando pulsa el botón "Mañana"
    Y busca al cliente de la prueba en la lista de pedidos
    Y pulsa Editar en el pedido del cliente de la prueba
    Y escribe "Calle nueva y Pasaje corto, edificio verde" en la dirección de entrega
    Y pulsa el botón "Guardar cambios"
    Entonces ve el aviso de que el pedido de la prueba fue actualizado
    Y ve en la lista del cliente de la prueba la dirección "Calle nueva y Pasaje corto, edificio verde"
    Y el pedido de la prueba sigue pendiente con la dirección "Calle nueva y Pasaje corto, edificio verde"

  Escenario: CP-12 Intentar registrar un pedido para hoy con una hora ya pasada
    Dado que el personal abre la pantalla de "Pedidos"
    Cuando pulsa el botón "Nuevo pedido"
    Y escribe el nombre del cliente de la prueba
    Y escribe "0991234567" en el teléfono del cliente
    Y escribe "Av. Cevallos y Montalvo, frente al parque" en la dirección de entrega
    Y hace clic en el mapa en la latitud -1.2412 y longitud -78.6150
    Y elige la fecha de entrega "hoy"
    Y escribe "00:00" en la hora de entrega
    Entonces ve el aviso de hora "La hora de entrega debe ser al menos 30 minutos después de la hora actual del servidor" bajo el campo de hora de entrega
    Cuando pulsa el botón "Registrar pedido"
    Entonces el sistema no registró ningún pedido del cliente de la prueba
