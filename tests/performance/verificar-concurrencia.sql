-- Verificacion en la base de la prueba de concurrencia (tests/performance/concurrencia.js).
-- Usar la fecha que muestra k6 al empezar:
--
--   docker exec -i logistica-postgis psql -U logistica -d logistica -v fecha=2027-03-01 < tests/performance/verificar-concurrencia.sql
--
-- Las tres primeras consultas deben devolver 0 filas en "violaciones".
\set ON_ERROR_STOP on
\if :{?fecha} \else \echo 'Falta la fecha: -v fecha=AAAA-MM-DD' \quit \endif

\echo '1) Rutas con mas pedidos que su maximo'
SELECT r.id AS ruta, r.max_pedidos, count(p.id) AS pedidos
FROM ruta r
JOIN pedido p ON p.ruta_id = r.id
WHERE r.fecha = :'fecha'
GROUP BY r.id, r.max_pedidos
HAVING count(p.id) > r.max_pedidos;

\echo '2) Posiciones repetidas dentro de una ruta'
SELECT p.ruta_id AS ruta, p.orden_en_ruta, count(*) AS repetidos
FROM pedido p
JOIN ruta r ON r.id = p.ruta_id
WHERE r.fecha = :'fecha'
GROUP BY p.ruta_id, p.orden_en_ruta
HAVING count(*) > 1;

\echo '3) Pedidos de la fecha que quedaron sin ruta o con una ruta de otra fecha o zona'
SELECT p.id AS pedido, p.estado, p.ruta_id
FROM pedido p
LEFT JOIN ruta r ON r.id = p.ruta_id
WHERE p.fecha_entrega = :'fecha'
  AND (p.ruta_id IS NULL OR r.fecha <> p.fecha_entrega OR r.zona_id <> p.zona_id);

\echo 'Resumen'
SELECT count(DISTINCT p.id)                                    AS pedidos,
       count(DISTINCT r.id)                                    AS rutas,
       (SELECT max(n) FROM (SELECT count(*) AS n FROM pedido
                             WHERE fecha_entrega = :'fecha' AND ruta_id IS NOT NULL
                             GROUP BY ruta_id) x)              AS maximo_por_ruta
FROM pedido p
LEFT JOIN ruta r ON r.id = p.ruta_id
WHERE p.fecha_entrega = :'fecha';
