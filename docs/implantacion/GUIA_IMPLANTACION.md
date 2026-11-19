# Guía de implantación en servidor local y en la nube (APE 6)

Implantación del Sistema de Gestión de Entregas y Rutas en dos entornos:

| Entorno | Servidor | Dirección |
|---|---|---|
| Local | Apache Tomcat 11 en Windows, PostGIS en Docker | http://localhost:8080 y http://IP-DE-LA-PC:8080 |
| Nube | Máquina virtual Ubuntu 24.04 en Azure for Students, Docker Compose y Caddy con HTTPS | https://DOMINIO.cloudapp.azure.com |

Las capturas se nombran **L-xx** para el entorno local, **N-xx** para la nube y **V-xx** para la validación.

## 0. Rama de trabajo

```powershell
git checkout develop
git pull
git checkout -b feature/implantacion-local-nube
```

Archivos de este cambio:

- `backend/pom.xml`: perfil `tomcat` que genera `logistica.war`. Sin el perfil se sigue generando el JAR de siempre.
- `backend/src/main/java/ec/edu/uta/logistica/ServletInitializer.java`: arranque del backend dentro de Tomcat.
- `web/src/utils/urlApi.js` y su prueba: la web acepta una ruta como `/logistica` en `VITE_API_URL`.
- `mobile/android/app/src/main/AndroidManifest.xml`: permiso de Internet para el APK de release.
- `implantacion/local-tomcat/`: configuración de Tomcat y script de despliegue.
- `implantacion/nube/`: Docker Compose, Caddyfile y script para preparar la VM.
- `implantacion/medir-tiempos.ps1`: tiempos de respuesta de ambos entornos.

Actualización automática de la nube (rama `feature/cd-local-nube`): `implantacion/nube/actualizar.sh`,
`logistica-actualizar.service`, `logistica-actualizar.timer` e `instalar-auto-actualizacion.sh`. La VM baja sola las
imágenes nuevas de `ghcr.io` y el flujo completo está en [docs/despliegue/CICD.md](../despliegue/CICD.md).

## 1. Servidor local con Apache Tomcat 11

Spring Boot 4 necesita Servlet 6.1, por eso tiene que ser Tomcat 11. Tomcat 10.1 no sirve.

1. Comprobar Java 21 y levantar PostGIS:
   ```powershell
   java -version
   docker compose up -d
   docker ps --filter name=logistica-postgis
   ```
   **L-01**: Java 21 y el contenedor `logistica-postgis` en estado healthy.
2. Descargar `apache-tomcat-11.0.x-windows-x64.zip` de https://tomcat.apache.org/download-11.cgi y descomprimirlo en `C:\tomcat11`.
3. Quitar las aplicaciones de ejemplo, que no deben quedar en un servidor:
   ```powershell
   Remove-Item C:\tomcat11\webapps\docs, C:\tomcat11\webapps\examples, C:\tomcat11\webapps\host-manager -Recurse -Force
   ```
4. Copiar `implantacion\local-tomcat\setenv.bat` a `C:\tomcat11\bin\` y revisar que `JAVA_HOME` apunte al JDK 21.
5. Copiar `implantacion\local-tomcat\tomcat-users.xml` a `C:\tomcat11\conf\` y cambiar la clave.
6. Ver la versión:
   ```powershell
   C:\tomcat11\bin\version.bat
   ```
   **L-02**: versión de Tomcat 11 y la JVM 21.
7. Compilar y copiar todo con el script:
   ```powershell
   powershell -ExecutionPolicy Bypass -File implantacion\local-tomcat\desplegar.ps1
   ```
   **L-03**: el script terminado con `Listo`.
8. Arrancar Tomcat:
   ```powershell
   C:\tomcat11\bin\startup.bat
   ```
   **L-04**: la consola de Tomcat con `Deployment of web application archive [logistica.war] has finished` y el log de Spring `Started ServletInitializer`.
9. Abrir http://localhost:8080/manager/html.
   **L-05**: Manager con `/` y `/logistica` en estado running.
10. Abrir http://localhost:8080/logistica/actuator/health y http://localhost:8080/logistica/api/servidor/hora.
    **L-06**: las dos respuestas.
11. Abrir http://localhost:8080.
    **L-07**: la web con `Tiempo real: conectado`.
12. Abrir el puerto para la red local, en PowerShell como administrador:
    ```powershell
    New-NetFirewallRule -DisplayName "Tomcat 8080 red local" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
    ipconfig
    ```

## 2. Servidor en la nube con Azure

1. Activar Azure for Students en https://azure.microsoft.com/free/students con el correo de la UTA.
   **N-01**: la suscripción Azure for Students en el portal.
2. Crear la máquina virtual en **Virtual machines > Create**:
   - Imagen: Ubuntu Server 24.04 LTS, x64.
   - Tamaño: **B2ats v2**, que entra en los servicios gratuitos. No usar las Arm, la imagen de PostGIS es solo x64.
   - Autenticación: clave SSH, usuario `azureuser`, descargar el `.pem`.
   - Puertos de entrada: SSH, HTTP y HTTPS.
   **N-02**: la pantalla Review + create.
3. En la VM ir a **Networking** y dejar SSH solo para tu IP.
   **N-03**: las reglas de entrada.
4. En **Overview > DNS name** poner una etiqueta, por ejemplo `logistica-grupod`.
   **N-04**: el nombre DNS completo.
5. Entrar por SSH, copiar los archivos de la nube y preparar la VM:
   ```powershell
   scp -i C:\ruta\clave.pem -r implantacion\nube azureuser@DOMINIO:~/logistica
   ssh -i C:\ruta\clave.pem azureuser@DOMINIO
   ```
   ```bash
   cd ~/logistica && bash preparar-vm.sh
   exit
   ```
   Volver a entrar y comprobar:
   ```bash
   docker version --format '{{.Server.Version}}'
   free -h
   ```
   **N-05**: Docker instalado y la swap de 2 GB.
6. En la PC construir las imágenes y subirlas a la VM. **Primera implantación manual:** desde la APE 7 el compose de la nube usa
   las imágenes de `ghcr.io` y la VM se actualiza sola (ver [docs/despliegue/CICD.md](../despliegue/CICD.md)), así que este
   paso solo hace falta si se trabaja sin GHCR; en ese caso hay que cambiar `image:` del backend y la web a las etiquetas locales:
   ```powershell
   docker build -t logistica-backend:nube backend
   docker build -t logistica-web:nube web
   docker save logistica-backend:nube logistica-web:nube -o logistica-imagenes.tar
   scp -i C:\ruta\clave.pem logistica-imagenes.tar azureuser@DOMINIO:~/logistica/
   ```
   **N-06**: las imágenes construidas y la subida terminada.
7. En la VM cargar las imágenes y levantar todo (con GHCR no hace falta `docker load`: `docker compose up -d` baja las imágenes, y
   `bash instalar-auto-actualizacion.sh` deja la actualización automática):
   ```bash
   cd ~/logistica
   docker load -i logistica-imagenes.tar
   cp .env.example .env && nano .env
   docker compose --env-file .env up -d
   docker compose ps
   ```
   **N-07**: los cuatro servicios en Up.
8. Abrir https://DOMINIO.
   **N-08**: la web con el candado y `Tiempo real: conectado`.
   **N-09**: el certificado de Let's Encrypt, desde el candado del navegador.

## 3. App móvil

Generar un APK por entorno:

```powershell
cd mobile
flutter build apk --release --dart-define=API_URL=http://IP-DE-LA-PC:8080/logistica
flutter build apk --release --dart-define=API_URL=https://DOMINIO
```

El APK queda en `mobile\build\app\outputs\flutter-apk\app-release.apk`.
**L-08** y **N-10**: la ruta del repartidor en el celular con cada servidor.

## 4. Validación

1. Flujo completo en cada entorno: registrar pedido, armar rutas, avanzar el estado desde el celular y ver el cambio en Seguimiento sin recargar.
   **L-09** y **N-11**.
2. Tiempos de respuesta:
   ```powershell
   powershell -ExecutionPolicy Bypass -File implantacion\medir-tiempos.ps1 -Nube https://DOMINIO
   ```
   **V-01**.
3. Seguridad de la nube:
   ```powershell
   curl.exe -sI http://DOMINIO
   curl.exe -sI https://DOMINIO
   Test-NetConnection DOMINIO -Port 8080
   Test-NetConnection DOMINIO -Port 5432
   ```
   **V-02**: redirección a HTTPS, cabeceras de seguridad y los puertos internos cerrados.

## 5. Apagar al terminar

- Local: `C:\tomcat11\bin\shutdown.bat` y `docker compose stop`.
- Nube: en el portal, **Stop** en la VM. Detenida no consume horas de cómputo.

## Si algo falla

| Problema | Solución |
|---|---|
| Tomcat no despliega `logistica.war` | Revisar `C:\tomcat11\logs\localhost.*.log`. Si dice `ClassNotFoundException`, revisar que sea Tomcat 11 y no 10.1 |
| La web muestra la pantalla en blanco al recargar `/pedidos` | Falta copiar `implantacion\local-tomcat\ROOT\*` sobre `webapps\ROOT` |
| `Tiempo real: desconectado` en la nube | Revisar que `DOMINIO` en `.env` sea igual al de la barra del navegador |
| Caddy no saca el certificado | El puerto 80 tiene que estar abierto en Azure y el DNS tiene que apuntar a la VM |
| El celular no conecta con Tomcat | Celular y PC en la misma red Wi-Fi, y la regla del firewall en perfil Private |
| El backend se reinicia en la nube | Falta memoria. Revisar `free -h` y que la swap esté activa |
