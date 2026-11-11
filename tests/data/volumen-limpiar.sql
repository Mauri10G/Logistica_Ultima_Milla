-- Borra SOLO los datos historicos creados por volumen.sql (pedidos 'HIST-...', sus rutas, su historial y
-- los clientes @volumen.test). No toca los pedidos creados por la API.
--
--   docker exec -i logistica-postgis psql -U logistica -d logistica < tests/data/volumen-limpiar.sql
\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE tmp_ruta_historica ON COMMIT DROP AS
SELECT DISTINCT ruta_id AS id FROM pedido WHERE direccion LIKE 'HIST-%' AND ruta_id IS NOT NULL;

-- El historial se borra en cascada (ON DELETE CASCADE)
DELETE FROM pedido WHERE direccion LIKE 'HIST-%';

DELETE FROM ruta r
USING tmp_ruta_historica h
WHERE r.id = h.id
  AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.ruta_id = r.id);

DELETE FROM cliente c
WHERE c.email LIKE '%@volumen.test'
  AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.cliente_id = c.id);

COMMIT;

SELECT (SELECT count(*) FROM pedido WHERE direccion LIKE 'HIST-%') AS pedidos_historicos,
       (SELECT count(*) FROM pedido)                               AS pedidos_totales,
       (SELECT count(*) FROM ruta)                                 AS rutas_totales;
