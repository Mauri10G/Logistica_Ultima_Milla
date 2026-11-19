#!/usr/bin/env bash
# Actualiza la aplicacion en la VM con las imagenes mas nuevas de ghcr.io (despliegue de tipo "pull").
# Lo corre systemd cada minuto (logistica-actualizar.timer). Tambien se puede correr a mano:  bash actualizar.sh
#   - Baja backend y web. Si no hay imagen nueva, no cambia nada y no escribe en el log.
#   - Si la descarga falla (sin red, paquete privado), NO toca los contenedores que estan corriendo.
#   - Si hubo imagen nueva, deja una linea con fecha y digest en ~/logistica/actualizaciones.log
set -uo pipefail

DIR="${LOGISTICA_DIR:-$HOME/logistica}"
LOG="$DIR/actualizaciones.log"
SERVICIOS=(backend web)

cd "$DIR" || { echo "No existe $DIR"; exit 1; }
[ -f .env ] || { echo "Falta $DIR/.env (copiar .env.example y completarlo)"; exit 1; }

# Una sola ejecucion a la vez: bajar el backend puede tardar mas de un minuto en una VM de 1 GB
exec 9>"$DIR/.actualizar.lock"
flock -n 9 || { echo "Ya hay una actualizacion en curso"; exit 0; }

COMPOSE=(docker compose --env-file .env)

# Nombre de la imagen de cada servicio segun el compose (ya con ETIQUETA resuelta)
imagen_de() { "${COMPOSE[@]}" config --images | grep "/logistica-$1:"; }
# Id local de la imagen; vacio si todavia no esta descargada
id_de() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true; }
digest_de() { docker image inspect --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{else}}{{.Id}}{{end}}' "$1" 2>/dev/null || true; }

declare -A IMAGEN ANTES
for s in "${SERVICIOS[@]}"; do
  IMAGEN[$s]="$(imagen_de "$s")" || { echo "No se pudo leer la imagen de $s del compose"; exit 1; }
  ANTES[$s]="$(id_de "${IMAGEN[$s]}")"
done

# Si falla, salimos sin tocar nada: los contenedores actuales siguen sirviendo
if ! "${COMPOSE[@]}" pull --quiet "${SERVICIOS[@]}"; then
  echo "No se pudieron bajar las imagenes (red o permisos de ghcr.io). Se conservan los contenedores actuales."
  exit 1
fi

# up -d solo recrea los servicios cuya imagen o configuracion cambio; tambien levanta lo que este detenido
"${COMPOSE[@]}" up -d --remove-orphans || { echo "docker compose up -d fallo"; exit 1; }

for s in "${SERVICIOS[@]}"; do
  despues="$(id_de "${IMAGEN[$s]}")"
  if [ -n "$despues" ] && [ "$despues" != "${ANTES[$s]}" ]; then
    echo "$(date --iso-8601=seconds) $s actualizado a $(digest_de "${IMAGEN[$s]}")" | tee -a "$LOG"
  fi
done

# Quita solo las imagenes viejas sin etiqueta que dejo la actualizacion
docker image prune -f >/dev/null
