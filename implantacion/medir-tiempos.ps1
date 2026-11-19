# Mide el tiempo de respuesta de la API en los dos servidores.
#   powershell -ExecutionPolicy Bypass -File implantacion\medir-tiempos.ps1 -Nube https://TU-DOMINIO
param(
  [string]$Local = "http://localhost:8080/logistica",
  [string]$Nube = "",
  [int]$N = 50
)
$urls = @("$Local/api/servidor/hora", "$Local/api/zonas")
if ($Nube) { $urls += @("$Nube/api/servidor/hora", "$Nube/api/zonas") }
foreach ($u in $urls) {
  Invoke-WebRequest $u -UseBasicParsing | Out-Null   # calentamiento
  $t = 1..$N | ForEach-Object { (Measure-Command { Invoke-WebRequest $u -UseBasicParsing | Out-Null }).TotalMilliseconds }
  $o = $t | Sort-Object
  $prom = ($t | Measure-Object -Average).Average
  "{0}`n   {1} peticiones   promedio {2:N0} ms   p95 {3:N0} ms   maximo {4:N0} ms" -f $u, $N, $prom, $o[[math]::Ceiling(0.95 * $N) - 1], $o[-1]
}
