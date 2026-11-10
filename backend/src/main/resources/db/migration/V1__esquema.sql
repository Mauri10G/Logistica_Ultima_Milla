-- Esquema inicial: zonas geograficas, repartidores, clientes, pedidos, rutas e historial de estados.
-- Geometrias en WGS84 (SRID 4326). Convencion: x = longitud, y = latitud.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE zona (
    id             BIGSERIAL PRIMARY KEY,
    nombre         VARCHAR(100)           NOT NULL UNIQUE,
    area           geometry(Polygon, 4326) NOT NULL,
    activa         BOOLEAN                NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMP              NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMP              NOT NULL DEFAULT now()
);

CREATE TABLE repartidor (
    id               BIGSERIAL PRIMARY KEY,
    nombres          VARCHAR(150) NOT NULL,
    telefono         VARCHAR(30)  NOT NULL,
    disponible       BOOLEAN      NOT NULL DEFAULT TRUE,
    capacidad_maxima INTEGER      NOT NULL DEFAULT 4 CHECK (capacidad_maxima > 0),
    activo           BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE cliente (
    id       BIGSERIAL PRIMARY KEY,
    nombres  VARCHAR(150) NOT NULL,
    telefono VARCHAR(30)  NOT NULL,
    email    VARCHAR(150)
);

CREATE TABLE ruta (
    id            BIGSERIAL PRIMARY KEY,
    fecha         DATE        NOT NULL,
    zona_id       BIGINT      NOT NULL REFERENCES zona (id),
    repartidor_id BIGINT      NOT NULL REFERENCES repartidor (id),
    estado        VARCHAR(20) NOT NULL DEFAULT 'ARMADA' CHECK (estado IN ('ARMADA', 'EN_CURSO', 'FINALIZADA')),
    max_pedidos   INTEGER     NOT NULL DEFAULT 4 CHECK (max_pedidos > 0),
    version       BIGINT      NOT NULL DEFAULT 0
);

CREATE TABLE pedido (
    id                      BIGSERIAL PRIMARY KEY,
    cliente_id              BIGINT                NOT NULL REFERENCES cliente (id),
    direccion               VARCHAR(255)          NOT NULL,
    ubicacion               geometry(Point, 4326) NOT NULL,
    zona_id                 BIGINT                NOT NULL REFERENCES zona (id),
    fecha_entrega           DATE                  NOT NULL,
    hora_entrega            TIME                  NOT NULL,
    fecha_registro          TIMESTAMP             NOT NULL DEFAULT now(),
    prioridad               VARCHAR(20)           NOT NULL DEFAULT 'NORMAL'
        CHECK (prioridad IN ('NORMAL', 'ALTA', 'URGENTE')),
    estado                  VARCHAR(20)           NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'ASIGNADO', 'RECOGIDO', 'EN_CAMINO', 'ENTREGADO')),
    registrado_por_personal BOOLEAN               NOT NULL DEFAULT TRUE,
    ruta_id                 BIGINT REFERENCES ruta (id),
    orden_en_ruta           INTEGER,
    version                 BIGINT                NOT NULL DEFAULT 0
);

CREATE TABLE historial_estado_pedido (
    id              BIGSERIAL PRIMARY KEY,
    pedido_id       BIGINT      NOT NULL REFERENCES pedido (id) ON DELETE CASCADE,
    estado_anterior VARCHAR(20),
    estado_nuevo    VARCHAR(20) NOT NULL,
    fecha_cambio    TIMESTAMP   NOT NULL DEFAULT now(),
    origen          VARCHAR(10) NOT NULL CHECK (origen IN ('WEB', 'MOVIL'))
);

-- Indices espaciales
CREATE INDEX idx_zona_area_gist ON zona USING GIST (area);
CREATE INDEX idx_pedido_ubicacion_gist ON pedido USING GIST (ubicacion);

-- Consulta principal: pedidos de una fecha, por zona y estado
CREATE INDEX idx_pedido_fecha_zona_estado ON pedido (fecha_entrega, zona_id, estado);

CREATE INDEX idx_pedido_ruta ON pedido (ruta_id);
CREATE INDEX idx_ruta_fecha_zona ON ruta (fecha, zona_id);
CREATE INDEX idx_ruta_repartidor_fecha ON ruta (repartidor_id, fecha);
CREATE INDEX idx_historial_pedido ON historial_estado_pedido (pedido_id, fecha_cambio);

-- Red de seguridad de concurrencia: dos pedidos nunca ocupan la misma posicion de una ruta.
CREATE UNIQUE INDEX uq_pedido_ruta_orden ON pedido (ruta_id, orden_en_ruta) WHERE ruta_id IS NOT NULL;
