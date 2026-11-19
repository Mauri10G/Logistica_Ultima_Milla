# CI/CD: de un push a `develop` a la nube y al entorno local

Un cambio subido a `develop` aparece **solo**, sin pasos manuales, en dos entornos:

| Entorno | Quién despliega | Dirección |
|---|---|---|
| **Nube** (VM de Azure, Docker Compose + Caddy) | La propia VM, con un timer de systemd que baja imágenes nuevas (despliegue *pull*) | https://logistica-grupod.chilecentral.cloudapp.azure.com |
| **Local** (laptop, Docker Desktop) | Jenkins, que revisa el repositorio cada minuto | Docker Compose http://localhost:8081 · Kubernetes http://localhost:8082 |

GitHub Actions **no entra por SSH** a la VM: el puerto 22 sigue limitado a la IP de la laptop.

## Flujo

```
 git push origin develop
          │
          ├──────────────────────────────┬───────────────────────────────────────────┐
          ▼                              ▼                                           ▼
 GitHub Actions: CI                 Jenkins (laptop)                          (nada más)
  ├─ backend  (mvnw verify)          pollSCM cada minuto ve el commit nuevo
  ├─ web      (lint+test+build)       ├─ pruebas backend y web (en contenedores)
  └─ publicar (solo push a develop)   ├─ construye imágenes locales
       │   build + push a ghcr.io     ├─ Docker Compose  → localhost:8081
       ▼                              ├─ prueba de humo (+ comprueba que el login exige token)
 ghcr.io/mauri10g/logistica-backend   └─ Kubernetes      → localhost:8082
 ghcr.io/mauri10g/logistica-web
   etiquetas: develop y sha-<commit>
       │
       ▼   (cada minuto)
 VM de Azure: logistica-actualizar.timer
  └─ actualizar.sh: docker compose pull → up -d → image prune
       └─ si hubo imagen nueva: línea en ~/logistica/actualizaciones.log
```

Las pruebas mandan: el job `publicar` depende de `backend` y `web`. Si el CI falla, no se publica nada y la VM sigue con la versión anterior.

## Qué hace cada pieza

- **`.github/workflows/ci.yml`**: jobs `backend` y `web` en push y PR; el job `publicar` corre **solo en push a `develop`**,
  con `packages: write` únicamente en ese job. Sube `logistica-backend` y `logistica-web` a `ghcr.io/mauri10g/` con las etiquetas
  `develop` y `sha-<commit corto>`. La web se compila con `VITE_API_URL=mismo-origen` y `VITE_AUTH_HABILITADA=true`.
  El job `backend` cachea `~/.m2/wrapper` y reintenta hasta 4 veces la descarga de Maven antes de las pruebas.
- **`implantacion/nube/docker-compose.yml`**: backend y web usan `ghcr.io/mauri10g/logistica-*:${ETIQUETA:-develop}`.
- **`implantacion/nube/actualizar.sh`**: baja backend y web; si no hay imagen nueva no cambia nada ni escribe en el log; si la
  descarga falla **no toca** los contenedores que están corriendo; si hubo imagen nueva deja una línea con fecha y digest en
  `~/logistica/actualizaciones.log`. Solo corre una instancia a la vez.
- **`logistica-actualizar.service` y `.timer`**: ejecutan el script como `azureuser` 30 segundos después de arrancar y luego cada minuto.
- **`instalar-auto-actualizacion.sh`**: instala el servicio y el timer, y deja Docker habilitado al arrancar la VM.
- **`Jenkinsfile`**: `pollSCM('* * * * *')`, un despliegue a la vez (`disableConcurrentBuilds`) y la prueba de humo comprueba además
  que `/api/pedidos` sin token responde 401 (login encendido). `despliegue/docker-compose.yml` y `k8s/` traen
  `SEGURIDAD_HABILITADA=true` y un `JWT_SECRETO` **solo de demostración local** (Secret `logistica-jwt` en Kubernetes).

## Pasos que se hacen una sola vez

### 1. GitHub: hacer públicos los paquetes

Los paquetes de GHCR nacen **privados**. Después del primer push a `develop` con el job `publicar` en verde:

1. GitHub > tu perfil > **Packages** > `logistica-backend` > **Package settings** > *Danger Zone* > **Change visibility** > **Public**.
2. Repite con `logistica-web`.

Es la opción recomendada porque el repositorio ya es público y la VM no necesita credenciales.

Alternativa (si prefieres paquetes privados): en la VM, `docker login ghcr.io -u TU_USUARIO` con un token clásico de GitHub que
tenga **solo** el permiso `read:packages`. Docker guarda la credencial en `~/.docker/config.json` y `actualizar.sh` la usa.

### 2. VM de Azure

Desde la laptop (PowerShell), copia los archivos nuevos y el compose actualizado a `~/logistica`. Se listan uno por uno para no
crear una carpeta `nube` dentro de `~/logistica`; el `.env` de la VM no se toca:

```powershell
$VM = "azureuser@logistica-grupod.chilecentral.cloudapp.azure.com"
$N = "implantacion\nube"
scp -i C:\ruta\clave.pem $N\docker-compose.yml $N\actualizar.sh $N\instalar-auto-actualizacion.sh $N\logistica-actualizar.service $N\logistica-actualizar.timer $N\.env.example "${VM}:~/logistica/"
ssh -i C:\ruta\clave.pem $VM
```

En la VM:

```bash
cd ~/logistica
nano .env        # DOMINIO, DB_USER, DB_PASSWORD y JWT_SECRETO ya están; ETIQUETA es opcional (por defecto develop)
bash instalar-auto-actualizacion.sh
```

La primera actualización corre a los ~30 segundos y baja las imágenes de GHCR (unos minutos en la VM de 1 GB). Los volúmenes
(base de datos y certificados) se conservan. Cuando termine, borra las imágenes viejas de la subida manual:

```bash
docker rmi logistica-backend:nube logistica-web:nube
```

### 3. Jenkins local

1. Abre http://localhost:8090 > job `logistica-despliegue` > **Configure** > **Pipeline**.
2. Cambia **Branch Specifier** de `*/feature/despliegue-ci-cd` a `*/develop` y guarda.
3. Pulsa **Build Now** una vez (con el Jenkinsfile ya mergeado a `develop`). Ahí Jenkins registra el sondeo; desde entonces corre solo.

### 4. Docker Desktop

**Settings > General > Start Docker Desktop when you sign in to your computer.** Jenkins (`restart: unless-stopped`), los
contenedores de `logistica-prod` y los pods de Kubernetes vuelven solos al arrancar Docker Desktop.

### Si se apaga y se prende todo

- **VM**: Docker arranca con el sistema (`systemctl enable docker`), los contenedores tienen `restart: unless-stopped` y el timer
  se activa solo. No hay que hacer nada.
- **Laptop**: al iniciar sesión se abre Docker Desktop y con él vuelven Jenkins y los despliegues. Si Kubernetes pierde la
  conexión desde Jenkins, regenera la copia del kubeconfig (paso 2.5 de `GUIA_DESPLIEGUE.md`).

## Cómo comprobar que funciona

**En la VM:**

```bash
systemctl list-timers logistica-actualizar        # NEXT y LAST: debe correr cada minuto
journalctl -u logistica-actualizar -n 30 --no-pager   # salida de las últimas ejecuciones
journalctl -u logistica-actualizar -f             # en vivo
tail ~/logistica/actualizaciones.log              # una línea por cada imagen nueva, con fecha y digest
docker compose ps                                 # cuatro servicios en Up
```

**En GitHub:** pestaña **Actions** > último run de `CI`: `backend`, `web` y `publicar` en verde. En la página principal del
repositorio, **Packages** muestra las dos imágenes con las etiquetas `develop` y `sha-...`.

**En Jenkins:** http://localhost:8090 > `logistica-despliegue` > vista de etapas; hay una ejecución nueva sin pulsar nada por cada
commit. En la barra lateral, **Git Polling Log** muestra las revisiones del repositorio.

## Guion de la demo para el docente

1. En `web/src/components/Layout.jsx`, cambia el lema: `Logística de última milla` por algo visible, por ejemplo
   `Logística de última milla · demo CI/CD`. Ninguna prueba depende de ese texto.
2. ```bash
   git checkout develop && git pull
   git add web/src/components/Layout.jsx
   git commit -m "feat(web): cambiar el lema de la marca para la demo de CI/CD"
   git push origin develop
   ```
3. En GitHub > **Actions**, mostrar el run de `CI`: `backend` y `web` en verde y luego el job `publicar`.
4. Mientras tanto, mostrar Jenkins (la ejecución nueva arranca sola) y, por SSH en la VM, `journalctl -u logistica-actualizar -f`.
5. Cuando termine, recargar con **Ctrl+F5**:
   - https://logistica-grupod.chilecentral.cloudapp.azure.com
   - http://localhost:8081 (y http://localhost:8082 para Kubernetes)

   El lema nuevo aparece junto a la marca, arriba a la izquierda, después de iniciar sesión.
6. Mostrar `tail ~/logistica/actualizaciones.log` con la línea nueva.

Para la demo, ten el login a mano: `staff` / `staff123` (usuarios de prueba, `docs/api-auth.md`).

## Cuánto tarda (aproximado)

| Parte | Tiempo |
|---|---|
| CI: `backend` + `web` (en paralelo) | 3 a 5 min |
| `publicar` (con caché de capas) | 2 a 4 min (hasta 8 la primera vez) |
| La VM detecta e instala | hasta 1 min para detectar + 1 a 3 min para bajar la imagen + 30 a 60 s de reinicio del backend |
| Jenkins local (detecta + pruebas + imágenes + Compose + Kubernetes) | 1 min para detectar + 6 a 12 min |
| **Total hasta verlo en la nube** | **unos 8 a 14 minutos** desde el push |

Durante el reinicio del backend en la nube (30 a 60 segundos) la web responde 502 y vuelve sola.
Conviene hacer el push **al menos 15 minutos antes** de la demo, o dejar un cambio ya publicado para mostrarlo en el momento.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| `publicar` no aparece en el run | Solo corre en **push a `develop`**, no en PR ni en otras ramas. Confirma la rama |
| `backend` falla con `Failed to fetch ...apache-maven...zip` | Corte de red con Maven Central. Reintenta solo 4 veces; si igual falla, **Re-run failed jobs** |
| `publicar` falla en el login a ghcr.io | Revisa que el workflow tenga `packages: write` y que **Settings > Actions > General > Workflow permissions** no lo bloquee |
| La VM no baja imágenes (`denied` o `unauthorized` en `journalctl`) | Los paquetes siguen privados: hazlos públicos (paso 1) o haz `docker login ghcr.io` en la VM |
| La VM no cambia | `systemctl status logistica-actualizar.timer`; ejecuta a mano `bash ~/logistica/actualizar.sh` y lee el mensaje |
| La VM se queda sin disco | `docker system df` y `docker image prune -a -f` (borra imágenes sin uso) |
| Algo salió mal con la versión nueva | En el `.env` de la VM pon `ETIQUETA=sha-<commit anterior>` y espera un minuto (el commit está en la lista de Packages) |
| Jenkins no arranca solo al hacer push | Confirma la rama `*/develop` y haz **Build Now** una vez; revisa **Git Polling Log** |
| El navegador sigue mostrando el texto viejo | Ctrl+F5, o ventana de incógnito |
| Kubernetes falla desde Jenkins | Regenera el kubeconfig (paso 2.5 de `GUIA_DESPLIEGUE.md`) o ejecuta el build con `DESPLEGAR_K8S` desmarcado |
| Jenkins falla bajando dependencias (`Premature end of Content-Length`, `wget: Failed to fetch`) | Corte de red; **Build Now** de nuevo |
