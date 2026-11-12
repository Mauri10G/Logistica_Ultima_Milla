-- Volumen: inserta pedidos HISTORICOS (ya entregados) directo en PostgreSQL, sin pasar por la API,
-- para medir como responden las consultas con la tabla llena.
--
--   docker exec -i logistica-postgis psql -U logistica -d logistica < tests/data/volumen.sql
--   docker exec -i logistica-postgis psql -U logistica -d logistica -v cantidad=500000 -v dias=730 < tests/data/volumen.sql
--
-- Variables (opcionales): cantidad (100000), dias hacia atras (365), max pedidos por ruta (4).
-- Los pedidos quedan repartidos en las zonas activas, en fechas pasadas, en rutas FINALIZADA de hasta
-- `max` pedidos y con su historial completo. Se reconocen por la direccion 'HIST-...' (ver volumen-limpiar.sql).
\set ON_ERROR_STOP on
\if :{?cantidad} \else \set cantidad 100000 \endif
\if :{?dias} \else \set dias 365 \endif
\if :{?max} \else \set max 4 \endif

BEGIN;

-- 1) Clientes historicos (solo la primera vez)
INSERT INTO cliente (nombres, telefono, email)
SELECT 'Cliente Historico ' || n, '07' || lpad(n::text, 8, '0'), 'historico' || n || '@volumen.test'
FROM generate_series(1, 2000) AS n
WHERE NOT EXISTS (SELECT 1 FROM cliente WHERE email LIKE '%@volumen.test');

-- 2) Puntos aleatorios DENTRO de cada zona activa, repartidos en partes iguales
CREATE TEMP TABLE tmp_pedido ON COMMIT DROP AS
WITH zonas AS (
    SELECT id, area, row_number() OVER (ORDER BY id) AS pos, count(*) OVER () AS total
    FROM zona
    WHERE activa
),
puntos AS (
    SELECT z.id AS zona_id,
           (ST_Dump(ST_GeneratePoints(
               z.area,
               (:cantidad / z.total + CASE WHEN z.pos <= :cantidad % z.total THEN 1 ELSE 0 END)::int))).geom AS geom
    FROM zonas z
),
clientes AS (
    SELECT array_agg(id) AS ids FROM cliente WHERE email LIKE '%@volumen.test'
)
SELECT nextval('pedido_id_seq')                                                      AS id,
       c.ids[1 + floor(random() * array_length(c.ids, 1))::int]                      AS cliente_id,
       p.zona_id,
       ST_SetSRID(p.geom, 4326)                                                      AS ubicacion,
       (now() AT TIME ZONE 'America/Guayaquil')::date - (1 + floor(random() * :dias))::int AS fecha_entrega,
       TIME '08:00' + floor(random() * 52) * INTERVAL '15 minutes'                   AS hora_entrega,
       (1 + floor(random() * 30))::int                                               AS dias_anticipacion,
       random()                                                                      AS azar
FROM puntos p
CROSS JOIN clientes c;

-- 3) Rutas: grupos de hasta :max pedidos por (zona, fecha), en orden de hora
CREATE TEMP TABLE tmp_asignado ON COMMIT DROP AS
SELECT p.*,
       (row_number() OVER w - 1) / :max     AS grupo,
       (row_number() OVER w - 1) % :max + 1 AS orden
FROM tmp_pedido p
WINDOW w AS (PARTITION BY zona_id, fecha_entrega ORDER BY hora_entrega, id);

CREATE TEMP TABLE tmp_ruta ON COMMIT DROP AS
SELECT nextval('ruta_id_seq') AS id, g.zona_id, g.fecha_entrega, g.grupo
FROM (SELECT DISTINCT zona_id, fecha_entrega, grupo FROM tmp_asignado) g;

INSERT INTO ruta (id, fecha, zona_id, repartidor_id, estado, max_pedidos)
SELECT r.id, r.fecha_entrega, r.zona_id, rep.ids[1 + (r.id % array_length(rep.ids, 1))::int], 'FINALIZADA', :max
FROM tmp_ruta r
CROSS JOIN (SELECT array_agg(id ORDER BY id) AS ids FROM repartidor WHERE activo) rep;

-- 4) Pedidos entregados
INSERT INTO pedido (id, cliente_id, direccion, ubicacion, zona_id, fecha_entrega, hora_entrega, fecha_registro,
                    prioridad, estado, registrado_por_personal, ruta_id, orden_en_ruta)
SELECT a.id,
       a.cliente_id,
       'HIST-' || a.id || ' Calle historica',
       a.ubicacion,
       a.zona_id,
       a.fecha_entrega,
       a.hora_entrega,
       a.fecha_entrega - a.dias_anticipacion + TIME '10:00',
       CASE WHEN a.azar < 0.1 THEN 'URGENTE' WHEN a.azar < 0.3 THEN 'ALTA' ELSE 'NORMAL' END,
       'ENTREGADO',
       a.azar < 0.65,
       r.id,
       a.orden
FROM tmp_asignado a
JOIN tmp_ruta r ON r.zona_id = a.zona_id AND r.fecha_entrega = a.fecha_entrega AND r.grupo = a.grupo;

-- 5) Historial completo de cada pedido
INSERT INTO historial_estado_pedido (pedido_id, estado_anterior, estado_nuevo, fecha_cambio, origen)
SELECT a.id, t.anterior, t.nuevo, a.fecha_entrega + a.hora_entrega + t.desfase, t.origen
FROM tmp_asignado a
CROSS JOIN (VALUES
    ('PENDIENTE', 'ASIGNADO',  INTERVAL '-14 hours',   'WEB'),
    ('ASIGNADO',  'RECOGIDO',  INTERVAL '-60 minutes', 'MOVIL'),
    ('RECOGIDO',  'EN_CAMINO', INTERVAL '-45 minutes', 'MOVIL'),
    ('EN_CAMINO', 'ENTREGADO', INTERVAL '0 minutes',   'MOVIL')
) AS t (anterior, nuevo, desfase, origen);

COMMIT;

ANALYZE pedido;
ANALYZE ruta;
ANALYZE historial_estado_pedido;

SELECT (SELECT count(*) FROM pedido WHERE direccion LIKE 'HIST-%')  AS pedidos_historicos,
       (SELECT count(*) FROM pedido)                                AS pedidos_totales,
       (SELECT count(*) FROM ruta)                                  AS rutas_totales,
       (SELECT count(*) FROM historial_estado_pedido)               AS filas_historial;
