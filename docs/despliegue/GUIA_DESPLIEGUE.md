# Guía de despliegue automatizado con Jenkins, Docker y Kubernetes

Pasos para ejecutar en Windows con Docker Desktop. Cada `C-XX` es una captura para el informe de la APE 7.
Guarda cada captura con su código como nombre, por ejemplo `C-08.png`.

## 0. Antes de empezar

- Docker Desktop actualizado, con al menos 6 GB de memoria en Settings > Resources.
- Los archivos nuevos de este cambio ya subidos a la rama `feature/despliegue-ci-cd` del repositorio:
  `backend/Dockerfile`, `backend/.dockerignore`, `backend/src/main/resources/application-prod.yml`,
  `web/Dockerfile`, `web/.dockerignore`, `web/nginx.conf`, `web/src/entorno.js`,
  `despliegue/docker-compose.yml`, `jenkins/Dockerfile`, `jenkins/docker-compose.yml`, `Jenkinsfile`, `k8s/*.yaml`.

```powershell
git checkout -b feature/despliegue-ci-cd
git add backend web despliegue jenkins k8s Jenkinsfile docs/despliegue
git commit -m "Agregar despliegue automatizado con Docker, Jenkins y Kubernetes"
git push -u origin feature/despliegue-ci-cd
```

## 1. Docker Desktop y Kubernetes

1. Abre PowerShell y ejecuta:
   ```powershell
   docker version
   docker compose version
   ```
   **C-01**: la salida de los dos comandos.
2. En Docker Desktop entra a la vista **Kubernetes**, pulsa **Create cluster** y elige **kubeadm**.
   Con kubeadm el clúster usa directamente las imágenes que construye Docker, sin subirlas a un registro.
3. Cuando esté en verde ejecuta:
   ```powershell
   kubectl config use-context docker-desktop
   kubectl get nodes
   ```
   **C-02**: Docker Desktop con Kubernetes en verde y la salida de `kubectl get nodes` con el nodo `docker-desktop` en Ready.

## 2. Instalar Jenkins en Docker

1. En la raíz del repositorio:
   ```powershell
   docker compose -f jenkins/docker-compose.yml up -d --build
   docker ps
   ```
   **C-03**: el final del build y `docker ps` con el contenedor `jenkins`.
2. Saca la contraseña inicial:
   ```powershell
   docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
3. Abre http://localhost:8090, pega la contraseña, elige **Install suggested plugins** y crea tu usuario administrador.
   **C-04**: la pantalla de instalación de plugins sugeridos.
4. En **Manage Jenkins > Plugins > Available plugins** instala **Pipeline: Stage View** si no está instalado.
5. Dentro del contenedor, `127.0.0.1:6443` es el propio contenedor y no el clúster, así que kubectl falla con
   `connection refused`. Crea una copia del kubeconfig para Jenkins que apunte a `host.docker.internal`.
   El Jenkinsfile ya usa esta copia con la variable `KUBECONFIG`:
   ```powershell
   docker exec jenkins sh -c "mkdir -p /var/jenkins_home/.kube && sed 's#https://127.0.0.1:6443#https://host.docker.internal:6443#' /root/.kube/config > /var/jenkins_home/.kube/config && kubectl --kubeconfig /var/jenkins_home/.kube/config config set-cluster docker-desktop --tls-server-name=kubernetes"
   ```
6. Comprueba que Jenkins ve Docker y Kubernetes:
   ```powershell
   docker exec jenkins docker version
   docker exec jenkins kubectl --kubeconfig /var/jenkins_home/.kube/config get nodes
   ```
   **C-05**: el panel principal de Jenkins y la salida de estos dos comandos.

## 3. Crear el pipeline

1. **New Item** > nombre `logistica-despliegue` > **Pipeline** > OK.
2. En **Pipeline** elige **Pipeline script from SCM**:
   - SCM: Git
   - Repository URL: `https://github.com/Mauri10G/Logistica_Ultima_Milla.git`
   - Si el repositorio es privado, agrega una credencial **Username with password** con tu usuario de GitHub y un token personal.
   - Branch Specifier: `*/develop` (antes `*/feature/despliegue-ci-cd`). Con el `pollSCM` del Jenkinsfile el job corre solo en
     cada commit nuevo; ver [CICD.md](CICD.md)
   - Script Path: `Jenkinsfile`
3. Guarda.
   **C-06**: la configuración del job mostrando la URL, la rama y el Script Path.

## 4. Ejecutar el pipeline

1. La primera vez pulsa **Build Now**. Jenkins lee el Jenkinsfile y descubre el parámetro.
   Desde la segunda vez aparece **Build with Parameters** con la casilla `DESPLEGAR_K8S` marcada.
   **C-07**: la pantalla de Build with Parameters.
2. Espera a que termine. La primera ejecución tarda porque descarga imágenes y dependencias.
   **C-08**: la vista de etapas con todas en verde.
3. Abre **Console Output** del build y captura:
   - **C-09**: la parte de *Pruebas backend* donde dice `Tests run: ... Failures: 0` y `BUILD SUCCESS`.
   - **C-10**: la parte de *Pruebas web* donde dice `Tests: 583 passed`.
   - **C-11**: la parte de *Prueba de humo* con la respuesta JSON de `/api/servidor/hora`.
   - **C-12**: el final con `kubectl get pods,svc` y `Finished: SUCCESS`.

## 5. Verificar Docker

```powershell
docker images | findstr logistica
docker compose -f despliegue/docker-compose.yml -p logistica-prod ps
```
- **C-13**: la salida de esos dos comandos.
- **C-14**: http://localhost:8081 abierto en el navegador, en la página Inicio con *Tiempo real: conectado*.
- **C-15**: Docker Desktop en la vista **Containers** mostrando el grupo `logistica-prod`.

## 6. Verificar Kubernetes y probar escalabilidad

```powershell
kubectl -n logistica get pods,svc,statefulset -o wide
```
- **C-16**: la salida del comando.
- **C-17**: http://localhost:8082 abierto en el navegador, la misma app servida por Kubernetes.

Escalado horizontal de la web:
```powershell
kubectl -n logistica scale deployment web --replicas=4
kubectl -n logistica get pods -l app=web
```
- **C-18**: los 4 pods de la web en Running.

Autorreparación, borra un pod a propósito:
```powershell
kubectl -n logistica delete pod <nombre-de-un-pod-web>
kubectl -n logistica get pods -l app=web
```
- **C-19**: Kubernetes creó un pod nuevo para volver a 4.

Rolling update: ejecuta el pipeline otra vez con **Build with Parameters** y luego:
```powershell
kubectl -n logistica rollout history deployment/backend
kubectl -n logistica describe deployment backend | findstr Image
```
- **C-20**: el historial con dos revisiones y la imagen con la etiqueta del build nuevo.

Para volver a dejar la web en 2 réplicas: `kubectl -n logistica scale deployment web --replicas=2`.

## Si algo falla

| Problema | Solución |
|---|---|
| La etapa de Kubernetes no conecta con el clúster | Repite el paso 2.5 para regenerar la copia del kubeconfig, por ejemplo después de reiniciar el clúster. Si sigue fallando, ejecuta el build con `DESPLEGAR_K8S` desmarcado y aplica los manifiestos desde PowerShell con los mismos comandos de la etapa |
| `ErrImagePull` en los pods | El clúster está en modo kind; cámbialo a kubeadm |
| `/bin/sh^M` al construir el backend | Git convirtió `mvnw` a CRLF; ejecuta `git add --renormalize .` y vuelve a hacer commit |
| `Premature end of Content-Length` al descargar dependencias de Maven | Es un corte de red; vuelve a ejecutar el build |
| La prueba de humo agota los intentos | Revisa `docker logs logistica-prod-backend`; normalmente es falta de memoria en Docker Desktop |
| El puerto 8081, 8082 u 8090 está ocupado | Cambia el puerto en el compose o en `k8s/04-web.yaml` |

Para limpiar todo al final:
```powershell
docker compose -f despliegue/docker-compose.yml -p logistica-prod down -v
kubectl delete namespace logistica
docker compose -f jenkins/docker-compose.yml down
```
