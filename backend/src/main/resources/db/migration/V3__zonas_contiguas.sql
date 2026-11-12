-- Zonas contiguas: las 5 zonas base de V2 quedaban separadas ~200 m entre si y un cliente que vivia en ese margen
-- era rechazado por "fuera de zona". Ahora comparten borde y no dejan huecos.
--
-- Solo se actualiza el AREA de cada zona (por nombre): ids, nombres, activa y los pedidos de V2 no cambian.
-- Cada poligono nuevo contiene por completo al rectangulo que tenia en V2, asi que todos los pedidos siguen
-- dentro de su misma zona. Las zonas vecinas usan EXACTAMENTE los mismos vertices en su borde comun
-- (sin vertices "sueltos" sobre el borde del vecino), de modo que sus interiores no se cruzan.
--
-- Poligonos en WKT con orden (longitud latitud). Bordes comunes (mismos vertices en ambos lados):
--   Centro / Ingahurco:      (-78.6250 -1.2354) a (-78.6050 -1.2346)
--   Centro / Sur-Huachi:     (-78.6250 -1.2468) a (-78.6050 -1.2474)
--   Ingahurco / Ficoa:       (-78.6250 -1.2354) a (-78.6250 -1.2230)
--   Ingahurco / Norte:       (-78.6250 -1.2230) a (-78.6050 -1.2230)
--   Ficoa / Norte:           (-78.6250 -1.2230) a (-78.6250 -1.2170)

UPDATE zona SET area = ST_GeomFromText(
    'POLYGON((-78.6250 -1.2468, -78.6050 -1.2474, -78.6050 -1.2346, -78.6250 -1.2354, -78.6250 -1.2468))', 4326),
    actualizado_en = now()
WHERE nombre = 'Centro';

UPDATE zona SET area = ST_GeomFromText(
    'POLYGON((-78.6250 -1.2354, -78.6050 -1.2346, -78.6050 -1.2230, -78.6250 -1.2230, -78.6250 -1.2354))', 4326),
    actualizado_en = now()
WHERE nombre = 'Ingahurco';

UPDATE zona SET area = ST_GeomFromText(
    'POLYGON((-78.6420 -1.2354, -78.6250 -1.2354, -78.6250 -1.2230, -78.6250 -1.2170, -78.6420 -1.2170, -78.6420 -1.2354))', 4326),
    actualizado_en = now()
WHERE nombre = 'Ficoa/Atocha';

UPDATE zona SET area = ST_GeomFromText(
    'POLYGON((-78.6250 -1.2230, -78.6050 -1.2230, -78.5900 -1.2230, -78.5900 -1.2020, -78.6210 -1.2020, -78.6250 -1.2170, -78.6250 -1.2230))', 4326),
    actualizado_en = now()
WHERE nombre = 'Norte/Izamba';

UPDATE zona SET area = ST_GeomFromText(
    'POLYGON((-78.6300 -1.2680, -78.6050 -1.2680, -78.6050 -1.2474, -78.6250 -1.2468, -78.6300 -1.2468, -78.6300 -1.2680))', 4326),
    actualizado_en = now()
WHERE nombre = 'Sur/Huachi';
