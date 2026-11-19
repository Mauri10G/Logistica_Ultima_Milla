# Compila el backend como WAR y la web para Tomcat, y los copia a webapps.
# Ejecutar desde la raiz del repo:  powershell -ExecutionPolicy Bypass -File implantacion\local-tomcat\desplegar.ps1
param([string]$Tomcat = "C:\tomcat11")
$ErrorActionPreference = "Stop"
$raiz = Get-Location

Write-Host "1/3 Backend: WAR con el perfil tomcat"
Set-Location "$raiz\backend"
.\mvnw.cmd -B -q -Ptomcat -DskipTests package
if ($LASTEXITCODE -ne 0) { throw "Fallo la compilacion del backend" }

Write-Host "2/3 Web: build con la API en el contexto /logistica"
Set-Location "$raiz\web"
$env:VITE_API_URL = "/logistica"
$env:VITE_AUTH_HABILITADA = "true"
npm ci --no-audit --no-fund
npm run build
if ($LASTEXITCODE -ne 0) { throw "Fallo la compilacion de la web" }
Remove-Item Env:\VITE_API_URL
Remove-Item Env:\VITE_AUTH_HABILITADA

Write-Host "3/3 Copiando a $Tomcat\webapps"
Set-Location $raiz
Remove-Item "$Tomcat\webapps\ROOT" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "web\dist" "$Tomcat\webapps\ROOT" -Recurse
Copy-Item "implantacion\local-tomcat\ROOT\*" "$Tomcat\webapps\ROOT" -Recurse -Force
Copy-Item "backend\target\logistica.war" "$Tomcat\webapps\logistica.war" -Force
Write-Host "Listo. Web en http://localhost:8080 y API en http://localhost:8080/logistica/api"
