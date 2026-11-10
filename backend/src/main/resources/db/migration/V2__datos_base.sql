-- Datos base: 5 zonas aproximadas de Ambato (NO se superponen ni se tocan), 6 repartidores,
-- 10 clientes y 20 pedidos de ejemplo para manana.
-- Poligonos en WKT con orden (longitud latitud). Cada zona es un rectangulo aproximado con un margen
-- de ~200 m respecto a sus vecinas.

INSERT INTO zona (nombre, area) VALUES
    ('Centro',
     ST_GeomFromText('POLYGON((-78.6240 -1.2460, -78.6100 -1.2460, -78.6100 -1.2360, -78.6240 -1.2360, -78.6240 -1.2460))', 4326)),
    ('Ingahurco',
     ST_GeomFromText('POLYGON((-78.6240 -1.2340, -78.6100 -1.2340, -78.6100 -1.2240, -78.6240 -1.2240, -78.6240 -1.2340))', 4326)),
    ('Ficoa/Atocha',
     ST_GeomFromText('POLYGON((-78.6420 -1.2340, -78.6260 -1.2340, -78.6260 -1.2180, -78.6420 -1.2180, -78.6420 -1.2340))', 4326)),
    ('Norte/Izamba',
     ST_GeomFromText('POLYGON((-78.6200 -1.2220, -78.5900 -1.2220, -78.5900 -1.2020, -78.6200 -1.2020, -78.6200 -1.2220))', 4326)),
    ('Sur/Huachi',
     ST_GeomFromText('POLYGON((-78.6300 -1.2680, -78.6050 -1.2680, -78.6050 -1.2480, -78.6300 -1.2480, -78.6300 -1.2680))', 4326));

INSERT INTO repartidor (nombres, telefono, disponible, capacidad_maxima) VALUES
    ('Carlos Mena',      '0991000001', TRUE, 4),
    ('Luis Salazar',     '0991000002', TRUE, 4),
    ('Andrea Naranjo',   '0991000003', TRUE, 4),
    ('Diego Vargas',     '0991000004', TRUE, 4),
    ('Paola Cevallos',   '0991000005', TRUE, 4),
    ('Marco Villacis',   '0991000006', TRUE, 4);

INSERT INTO cliente (nombres, telefono, email) VALUES
    ('Maria Torres',     '0982000001', 'maria.torres@example.com'),
    ('Jorge Altamirano', '0982000002', NULL),
    ('Sofia Paredes',    '0982000003', 'sofia.paredes@example.com'),
    ('Pedro Lopez',      '0982000004', NULL),
    ('Lucia Freire',     '0982000005', 'lucia.freire@example.com'),
    ('Ricardo Mora',     '0982000006', NULL),
    ('Elena Guevara',    '0982000007', 'elena.guevara@example.com'),
    ('Hugo Ramos',       '0982000008', NULL),
    ('Camila Pazmino',   '0982000009', 'camila.pazmino@example.com'),
    ('Daniel Chiluisa',  '0982000010', NULL);

-- 20 pedidos para manana. La zona se calcula con ST_Contains, igual que al registrar un pedido.
INSERT INTO pedido (cliente_id, direccion, ubicacion, zona_id, fecha_entrega, hora_entrega,
                    fecha_registro, prioridad, estado, registrado_por_personal)
SELECT c.id,
       v.direccion,
       p.geom,
       z.id,
       (now() AT TIME ZONE 'America/Guayaquil')::date + 1,
       v.hora,
       now(),
       'NORMAL',
       'PENDIENTE',
       TRUE
FROM (VALUES
    -- Centro (6)
    ('Maria Torres',     'Bolivar y Mera',              -78.6197, -1.2412, TIME '09:00'),
    ('Jorge Altamirano', 'Cevallos y Montalvo',         -78.6185, -1.2440, TIME '09:30'),
    ('Sofia Paredes',    'Sucre y Lalama',              -78.6160, -1.2385, TIME '10:00'),
    ('Pedro Lopez',      'Juan Benigno Vela y Martinez', -78.6135, -1.2420, TIME '10:30'),
    ('Lucia Freire',     'Rocafuerte y Eugenio Espejo', -78.6215, -1.2375, TIME '11:00'),
    ('Ricardo Mora',     'Unidad Nacional y Colon',     -78.6120, -1.2450, TIME '11:30'),
    -- Ingahurco (4)
    ('Elena Guevara',    'Av. Los Chasquis y Rio Cutuchi', -78.6200, -1.2300, TIME '12:00'),
    ('Hugo Ramos',       'Av. Atahualpa y Pasaje 5',    -78.6170, -1.2270, TIME '12:30'),
    ('Camila Pazmino',   'Quis Quis y Pasteur',         -78.6130, -1.2320, TIME '13:00'),
    ('Daniel Chiluisa',  'Ingahurco, calle Principal',  -78.6220, -1.2255, TIME '13:30'),
    -- Ficoa/Atocha (3)
    ('Maria Torres',     'Av. Ficoa y Los Capulies',    -78.6350, -1.2250, TIME '14:00'),
    ('Jorge Altamirano', 'Atocha, calle de los Naranjos', -78.6320, -1.2300, TIME '14:30'),
    ('Sofia Paredes',    'Ficoa, via a Pasa',           -78.6390, -1.2200, TIME '15:00'),
    -- Norte/Izamba (4)
    ('Pedro Lopez',      'Izamba, Av. Rodrigo Pachano', -78.6050, -1.2100, TIME '15:30'),
    ('Lucia Freire',     'Izamba, calle 1',             -78.5980, -1.2150, TIME '16:00'),
    ('Ricardo Mora',     'Av. de las Americas y Puyo',  -78.6120, -1.2050, TIME '16:30'),
    ('Elena Guevara',    'Izamba, barrio San Vicente',  -78.5930, -1.2080, TIME '17:00'),
    -- Sur/Huachi (3)
    ('Hugo Ramos',       'Huachi Chico, Av. Victor Hugo', -78.6200, -1.2580, TIME '17:30'),
    ('Camila Pazmino',   'Huachi La Libertad',          -78.6120, -1.2640, TIME '18:00'),
    ('Daniel Chiluisa',  'Huachi Loreto, calle 3',      -78.6250, -1.2520, TIME '18:30')
) AS v(cliente, direccion, lng, lat, hora)
JOIN cliente c ON c.nombres = v.cliente
CROSS JOIN LATERAL (SELECT ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326) AS geom) p
JOIN zona z ON ST_Contains(z.area, p.geom);
