-- Borra los pedidos que crearon las pruebas (k6 y generar-pedidos.js), con sus rutas, su historial y sus clientes.
-- Sirve para dejar la base lista antes de una ronda de pruebas sin borrar todo con `docker compose down -v`.
--
--   docker exec -i logistica-postgis psql -U logistica -d logistica -v simular=1 < tests/data/limpiar-pruebas.sql
--   docker exec -i logistica-postgis psql -U logistica -d logistica < tests/data/limpiar-pruebas.sql
--   docker exec -i logistica-postgis psql -U logistica -d logistica -v origen=k6 -v desde=2027-06-01 -v hasta=2027-12-31 < tests/data/limpiar-pruebas.sql
--
-- Variables (todas opcionales):
--   origen   k6 | generador | todo (por defecto: todo)
--            k6        -> pedidos de tests/performance (direccion 'Direccion k6 ...')
--            generador -> pedidos de generar-pedidos.js (direccion 'Calle N y Av. M (zona)')
--   desde    primera fecha de entrega a borrar, AAAA-MM-DD (por defecto: sin limite)
--   hasta    ultima fecha de entrega a borrar, AAAA-MM-DD (por defecto: sin limite)
--   simular  1 = solo muestra lo que borraria y deshace todo (por defecto: 0)
--
-- Nunca toca los pedidos de los datos base (V2) ni los historicos de volumen.sql (para esos: volumen-limpiar.sql).
\set ON_ERROR_STOP on
\if :{?origen} \else \set origen todo \endif
\if :{?desde} \else \set desde 0001-01-01 \endif
\if :{?hasta} \else \set hasta 9999-12-31 \endif
\if :{?simular} \else \set simular 0 \endif

BEGIN;

CREATE TEMP TABLE tmp_borrar ON COMMIT DROP AS
SELECT p.id, p.ruta_id, p.cliente_id
FROM pedido p
WHERE p.fecha_entrega BETWEEN :'desde'::date AND :'hasta'::date
  AND p.direccion NOT LIKE 'HIST-%'
  AND (
        (:'origen' IN ('k6', 'todo') AND p.direccion LIKE 'Direccion k6 %')
     OR (:'origen' IN ('generador', 'todo') AND p.direccion ~ '^Calle [0-9]+ y Av\. [0-9]+ \(.+\)$')
  );

-- pedido.cliente_id no tiene indice: sin este, borrar cada cliente revisa la tabla de pedidos completa (clave foranea)
-- y con cientos de miles de clientes no termina. Se crea solo durante la limpieza y se borra antes de terminar.
CREATE INDEX tmp_limpieza_pedido_cliente ON pedido (cliente_id);

\echo 'A borrar:'
SELECT count(*)                  AS pedidos,
       count(DISTINCT ruta_id)   AS rutas_afectadas,
       count(DISTINCT cliente_id) AS clientes
FROM tmp_borrar;

-- El historial de estados se borra en cascada (ON DELETE CASCADE)
DELETE FROM pedido p USING tmp_borrar b WHERE p.id = b.id;

-- Rutas que quedaron vacias
DELETE FROM ruta r
WHERE r.id IN (SELECT DISTINCT ruta_id FROM tmp_borrar WHERE ruta_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.ruta_id = r.id);

-- Clientes de esos pedidos que ya no tienen ningun pedido
DELETE FROM cliente c
WHERE c.id IN (SELECT DISTINCT cliente_id FROM tmp_borrar)
  AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.cliente_id = c.id);

\echo 'Queda en la base:'
SELECT (SELECT count(*) FROM pedido)                  AS pedidos,
       (SELECT count(*) FROM ruta)                    AS rutas,
       (SELECT count(*) FROM historial_estado_pedido) AS historial,
       (SELECT count(*) FROM cliente)                 AS clientes;

\if :simular
  \echo 'SIMULACION: no se borro nada (ROLLBACK).'
  ROLLBACK;
\else
  DROP INDEX tmp_limpieza_pedido_cliente;
  COMMIT;
  ANALYZE pedido;
  ANALYZE ruta;
  ANALYZE cliente;
  ANALYZE historial_estado_pedido;
\endif
