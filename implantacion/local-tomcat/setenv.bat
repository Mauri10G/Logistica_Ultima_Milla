@echo off
rem Copiar a C:\tomcat11\bin\setenv.bat. Tomcat lo lee solo al arrancar con startup.bat.
rem Ajustar JAVA_HOME a la carpeta del JDK 21 instalado.
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21"

rem Perfil prod del backend y memoria de la JVM
set "CATALINA_OPTS=%CATALINA_OPTS% -Dspring.profiles.active=prod -Xms256m -Xmx768m -Dfile.encoding=UTF-8"

rem Conexion a PostGIS. Es el contenedor del docker-compose.yml de la raiz, en el puerto 5433.
set "DB_URL=jdbc:postgresql://localhost:5433/logistica"
set "DB_USER=logistica"
set "DB_PASSWORD=logistica"

rem Seguridad con login JWT. La clave debe tener al menos 32 caracteres, cambiarla por una propia
set "SEGURIDAD_HABILITADA=true"
set "JWT_SECRETO=cambiar-por-una-clave-larga-de-32-o-mas-caracteres"

rem Origenes permitidos para el WebSocket: la propia PC y la red local
set "LOGISTICA_CORS_ORIGENESPERMITIDOS_0=http://localhost:*"
set "LOGISTICA_CORS_ORIGENESPERMITIDOS_1=http://192.168.*:*"
