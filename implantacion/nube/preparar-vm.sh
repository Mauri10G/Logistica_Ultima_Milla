#!/usr/bin/env bash
# Prepara la VM Ubuntu 24.04 de Azure: Docker, swap y firewall.
#   bash preparar-vm.sh
set -euo pipefail

echo "1/3 Docker Engine y el plugin compose"
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

echo "2/3 Swap de 2 GB, la VM gratuita tiene 1 GB de RAM"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "3/3 Firewall: solo SSH, HTTP y HTTPS"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "Listo. Cierra la sesion SSH y vuelve a entrar para usar docker sin sudo."
