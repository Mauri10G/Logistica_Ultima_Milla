# language: es
Característica: Inicio de sesión del personal
  Para que solo el personal autorizado use la web
  Como dueño del negocio
  Quiero que la web pida usuario y clave y rechace a quien no es del personal

  # Este feature no tiene Antecedentes de inicio de sesión: cada escenario parte sin sesión. Requiere el backend con
  # SEGURIDAD_HABILITADA=true y la web con VITE_AUTH_HABILITADA=true (ver tests/acceptance/README.md).

  Escenario: Sin sesión la web pide iniciar sesión
    Cuando abre la pantalla de Pedidos sin haber iniciado sesión
    Entonces ve la pantalla de inicio de sesión

  Escenario: El personal inicia sesión y entra a Inicio
    Dado que el personal abre la pantalla de inicio de sesión
    Entonces ve la pantalla de inicio de sesión
    Cuando escribe el usuario y la clave del personal
    Y pulsa el botón "Ingresar"
    Entonces ve la pantalla de Inicio

  Escenario: Usuario o clave incorrectos
    Dado que el personal abre la pantalla de inicio de sesión
    Cuando escribe el usuario "nadie" y la clave "clave-incorrecta"
    Y pulsa el botón "Ingresar"
    Entonces ve el mensaje de error "Usuario o clave incorrectos"
    Y ve la pantalla de inicio de sesión

  Escenario: Clave incorrecta de un usuario que sí existe
    Dado que el personal abre la pantalla de inicio de sesión
    Cuando escribe el usuario "staff" y la clave "clave-incorrecta"
    Y pulsa el botón "Ingresar"
    Entonces ve el mensaje de error "Usuario o clave incorrectos"
    Y ve la pantalla de inicio de sesión

  Escenario: Un repartidor no tiene acceso a la web
    Dado que el personal abre la pantalla de inicio de sesión
    Cuando escribe el usuario y la clave de un repartidor
    Y pulsa el botón "Ingresar"
    Entonces ve la pantalla "Sin acceso"

  Escenario: Cerrar sesión devuelve a la pantalla de inicio de sesión
    Dado que el personal abre la pantalla de inicio de sesión
    Cuando escribe el usuario y la clave del personal
    Y pulsa el botón "Ingresar"
    Y pulsa el botón "Cerrar sesión"
    Entonces ve la pantalla de inicio de sesión
