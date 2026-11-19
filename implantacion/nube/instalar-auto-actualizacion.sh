#!/usr/bin/env bash
# Instala el timer de systemd que actualiza la aplicacion cada minuto. Se corre una sola vez en la VM:
#   cd ~/logistica && bash instalar-auto-actualizacion.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

[ -f .env ] || { echo "Falta $DIR/.env: copia .env.example a .env y completalo antes de instalar"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Este usuario no puede usar docker. Corre preparar-vm.sh y vuelve a entrar por SSH"; exit 1; }

echo "1/4 Docker arranca con la VM"
sudo systemctl enable docker
systemctl is-enabled docker

echo "2/4 Servicio y timer de systemd"
chmod +x actualizar.sh
sudo install -m 644 logistica-actualizar.service logistica-actualizar.timer /etc/systemd/system/
sudo systemctl daemon-reload

echo "3/4 Activar el timer"
sudo systemctl enable --now logistica-actualizar.timer

echo "4/4 Comprobacion"
systemctl is-enabled logistica-actualizar.timer
systemctl list-timers logistica-actualizar.timer --no-pager

echo
echo "Listo. La primera actualizacion corre en unos 30 segundos. Para verla:"
echo "  journalctl -u logistica-actualizar -f"
echo "  tail ~/logistica/actualizaciones.log"
