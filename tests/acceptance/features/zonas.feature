# language: es
Característica: Gestión de zonas de reparto
  Para que los pedidos se agrupen por zona geográfica
  Como personal del negocio
  Quiero dibujar, editar y revisar las zonas de reparto en el mapa

  # Las zonas de prueba se dibujan en una franja vacía al sur de las zonas base (latitud menor a -1.2730),
  # así no se superponen con ellas salvo en CP-08.

  Escenario: CP-06 Crear una nueva zona de reparto
    Dado que el personal abre la pantalla de "Zonas"
    Cuando escribe el nombre de la zona de la prueba
    Y hace clic en el mapa en la latitud -1.2730 y longitud -78.6340
    Y hace clic en el mapa en la latitud -1.2730 y longitud -78.6000
    Y hace clic en el mapa en la latitud -1.2817 y longitud -78.6000
    Y hace clic en el mapa en la latitud -1.2817 y longitud -78.6340
    Y pulsa el botón "Cerrar polígono"
    Y pulsa el botón "Guardar zona"
    Entonces ve el aviso de que la zona de la prueba fue "creada"
    Y no ve ninguna advertencia de superposición
    Y el sistema guardó la zona de la prueba como activa
    Cuando ordena la tabla de zonas de mayor a menor número
    Entonces ve la zona de la prueba en la tabla de zonas

  Escenario: CP-07 Editar los límites de una zona de reparto existente
    Dado que existe la zona de la prueba con los vértices
      | latitud | longitud |
      | -1.2730 | -78.6340 |
      | -1.2730 | -78.6000 |
      | -1.2817 | -78.6000 |
      | -1.2817 | -78.6340 |
    Y que el personal abre la pantalla de "Zonas"
    Cuando ordena la tabla de zonas de mayor a menor número
    Y pulsa Editar en la zona de la prueba
    Y pulsa el botón "Limpiar"
    Y hace clic en el mapa en la latitud -1.2740 y longitud -78.6300
    Y hace clic en el mapa en la latitud -1.2740 y longitud -78.6200
    Y hace clic en el mapa en la latitud -1.2800 y longitud -78.6200
    Y hace clic en el mapa en la latitud -1.2800 y longitud -78.6300
    Y pulsa el botón "Cerrar polígono"
    Y pulsa el botón "Guardar cambios"
    Entonces ve el aviso de que la zona de la prueba fue "actualizada"
    Y la zona de la prueba queda con límites entre las longitudes -78.6300 y -78.6200

  Escenario: CP-08 Intentar crear una zona que se superpone con una zona existente
    Dado que existe la zona "existente" con los vértices
      | latitud | longitud |
      | -1.2730 | -78.6340 |
      | -1.2730 | -78.6000 |
      | -1.2817 | -78.6000 |
      | -1.2817 | -78.6340 |
    Y que el personal abre la pantalla de "Zonas"
    Cuando escribe el nombre de la zona de la prueba
    Y hace clic en el mapa en la latitud -1.2760 y longitud -78.6250
    Y hace clic en el mapa en la latitud -1.2760 y longitud -78.5900
    Y hace clic en el mapa en la latitud -1.2800 y longitud -78.5900
    Y hace clic en el mapa en la latitud -1.2800 y longitud -78.6250
    Y pulsa el botón "Cerrar polígono"
    Y pulsa el botón "Guardar zona"
    Entonces ve la advertencia de superposición con la zona existente
    Y el sistema no guardó la zona de la prueba
    Cuando pulsa el botón "Guardar de todas formas"
    Entonces ve el diálogo de confirmación "¿Guardar la zona aunque se superponga?"
    Y el diálogo de confirmación menciona "existente"
    Cuando pulsa "Guardar de todas formas" en el diálogo de confirmación
    Entonces ve el aviso de que la zona de la prueba fue "creada"
    Y el sistema guardó la zona de la prueba como activa

  Escenario: CP-13 Crear una zona pegada a otra compartiendo borde sin advertencia
    Dado que existe la zona "vecina" con los vértices
      | latitud | longitud |
      | -1.2730 | -78.6340 |
      | -1.2730 | -78.6170 |
      | -1.2817 | -78.6170 |
      | -1.2817 | -78.6340 |
    Y que el personal abre la pantalla de "Zonas"
    Cuando escribe el nombre de la zona de la prueba
    Y hace clic en el mapa en la latitud -1.2730 y longitud -78.6170
    Entonces ve que el punto quedó pegado a un vértice de la zona vecina
    Cuando hace clic en el mapa en la latitud -1.2730 y longitud -78.6000
    Y hace clic en el mapa en la latitud -1.2817 y longitud -78.6000
    Y hace clic en el mapa en la latitud -1.2817 y longitud -78.6170
    Y pulsa el botón "Cerrar polígono"
    Y pulsa el botón "Guardar zona"
    Entonces ve el aviso de que la zona de la prueba fue "creada"
    Y no ve ninguna advertencia de superposición
    Y el sistema guardó la zona de la prueba como activa
    Y la zona de la prueba comparte el borde con la zona vecina
