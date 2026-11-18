-- Usuarios del sistema para el login con JWT (ver docs/api-auth.md).
--   STAFF   : personal del negocio, usa la web. No tiene repartidor.
--   COURIER : repartidor, usa la app movil. Siempre apunta a su repartidor.
-- La clave se guarda con BCrypt (costo 10), nunca en texto plano.

CREATE TABLE usuario (
    id            BIGSERIAL PRIMARY KEY,
    usuario       VARCHAR(50)  NOT NULL,
    clave         VARCHAR(100) NOT NULL,
    rol           VARCHAR(20)  NOT NULL CHECK (rol IN ('STAFF', 'COURIER')),
    repartidor_id BIGINT REFERENCES repartidor (id),
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT ck_usuario_courier_con_repartidor
        CHECK ((rol = 'COURIER' AND repartidor_id IS NOT NULL) OR (rol = 'STAFF' AND repartidor_id IS NULL))
);

-- El login no distingue mayusculas en el nombre de usuario.
CREATE UNIQUE INDEX uq_usuario_usuario ON usuario (lower(usuario));
-- Un repartidor tiene a lo sumo un usuario.
CREATE UNIQUE INDEX uq_usuario_repartidor ON usuario (repartidor_id) WHERE repartidor_id IS NOT NULL;

-- staff / staff123
INSERT INTO usuario (usuario, clave, rol)
VALUES ('staff', '$2a$10$v01mHlUorH.heCaXzqsemeywzRt/Na1BSBMmrnGqZrwFNKJcJlZDm', 'STAFF');

-- Un usuario por cada repartidor de V2, todos con la clave repartidor123.
INSERT INTO usuario (usuario, clave, rol, repartidor_id)
SELECT v.usuario, '$2a$10$Arqn65JZO9WAzUz.Hb0vJ.Xe14QeaWdI7Rxb61wJQ7CnLZEcwOuwO', 'COURIER', r.id
FROM (VALUES
    ('carlos', 'Carlos Mena'),
    ('luis',   'Luis Salazar'),
    ('andrea', 'Andrea Naranjo'),
    ('diego',  'Diego Vargas'),
    ('paola',  'Paola Cevallos'),
    ('marco',  'Marco Villacis')
) AS v(usuario, nombres)
JOIN repartidor r ON r.nombres = v.nombres;
