#!/usr/bin/env bash
# Escaneo pasivo del backend con OWASP ZAP (Docker), en dos pasadas:
#   1) baseline: la raiz del backend sin token (cabeceras, paginas publicas, Swagger).
#   2) api: importa la documentacion OpenAPI y recorre los endpoints con el token de STAFF, en modo seguro (-S): solo
#      observa las respuestas, no ataca.
#
# OJO: al importar OpenAPI, ZAP llama a CADA operacion de la documentacion con datos de ejemplo, tambien PUT, PATCH y
# DELETE, y eso modifica la base (en la primera prueba dejo un repartidor como "John Doe" y desactivado). Por eso el
# script le pasa a ZAP una copia de la documentacion con solo las operaciones de lectura (GET) y el login.
#
#   bash tests/security/zap.sh                      # backend en http://localhost:8080
#   bash tests/security/zap.sh antes                # sufijo para los reportes (antes / despues de las correcciones)
#   BASE_URL=http://servidor:8080 bash tests/security/zap.sh
#
# Desde Git Bash, en la raiz del repositorio. Reportes en tests/security/reports/ (no se versionan; para el informe se
# copian a docs/evidencias/seguridad/).
set -euo pipefail

SUFIJO="${1:-$(date +%Y-%m-%d)}"
BASE_URL="${BASE_URL:-http://localhost:8080}"
API_USUARIO="${API_USUARIO:-staff}"
API_CLAVE="${API_CLAVE:-staff123}"
IMAGEN="ghcr.io/zaproxy/zaproxy:stable"
# El contenedor ve el localhost de la PC como host.docker.internal
OBJETIVO="${BASE_URL/localhost/host.docker.internal}"
REPORTES="$(cd "$(dirname "$0")" && pwd)/reports"
mkdir -p "$REPORTES"

echo "Login como $API_USUARIO en $BASE_URL ..."
TOKEN=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d "{\"usuario\":\"$API_USUARIO\",\"clave\":\"$API_CLAVE\"}" "$BASE_URL/api/auth/login" |
  sed -E 's/.*"token":"([^"]+)".*/\1/')
[ -n "$TOKEN" ] || { echo "No se pudo iniciar sesion en $BASE_URL"; exit 1; }

echo "Documentacion OpenAPI solo de lectura ..."
curl -sf "$BASE_URL/v3/api-docs" | node -e '
  let t = ""; process.stdin.on("data", (d) => (t += d)).on("end", () => {
    const doc = JSON.parse(t); let quitadas = 0;
    for (const [ruta, ops] of Object.entries(doc.paths)) {
      for (const metodo of Object.keys(ops)) {
        const lectura = metodo === "get" || (metodo === "post" && ruta === "/api/auth/login");
        if (["post", "put", "patch", "delete"].includes(metodo) && !lectura) { delete ops[metodo]; quitadas++; }
      }
      if (Object.keys(ops).length === 0) delete doc.paths[ruta];
    }
    process.stdout.write(JSON.stringify(doc));
    console.error(`  ${quitadas} operaciones de escritura quitadas, quedan ${Object.keys(doc.paths).length} rutas`);
  });' > "$REPORTES/openapi-solo-lectura.json"

# MSYS_NO_PATHCONV evita que Git Bash convierta /zap/wrk en una ruta de Windows
export MSYS_NO_PATHCONV=1

echo "1/2 Baseline de $OBJETIVO ..."
docker run --rm -v "$REPORTES:/zap/wrk:rw" -t "$IMAGEN" zap-baseline.py \
  -t "$OBJETIVO" \
  -r "zap-baseline-$SUFIJO.html" -J "zap-baseline-$SUFIJO.json" -I || true

echo "2/2 API con token (operaciones de lectura) ..."
docker run --rm -v "$REPORTES:/zap/wrk:rw" -t "$IMAGEN" zap-api-scan.py \
  -t /zap/wrk/openapi-solo-lectura.json -f openapi -S -O "$OBJETIVO" \
  -r "zap-api-$SUFIJO.html" -J "zap-api-$SUFIJO.json" -I \
  -z "-config replacer.full_list(0).description=token \
      -config replacer.full_list(0).enabled=true \
      -config replacer.full_list(0).matchtype=REQ_HEADER \
      -config replacer.full_list(0).matchstr=Authorization \
      -config replacer.full_list(0).regex=false \
      -config replacer.full_list(0).replacement=Bearer\ $TOKEN" || true

echo "Listo. Reportes en $REPORTES:"
ls -1 "$REPORTES" | grep -E "zap-.*-$SUFIJO\.(html|json)$"
