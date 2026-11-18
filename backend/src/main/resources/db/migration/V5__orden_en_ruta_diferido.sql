-- Ajustes manuales de rutas (reordenar paradas, sacar o mover un pedido) renumeran orden_en_ruta de varios pedidos en
-- la misma transaccion. Con el indice unico de V1, que se verifica fila por fila, un intercambio (1 <-> 2) choca a
-- mitad de camino aunque el resultado final sea valido.
--
-- Se reemplaza por una restriccion UNIQUE DIFERIBLE que se verifica al hacer COMMIT: sigue garantizando que dos pedidos
-- nunca ocupen la misma posicion de una ruta (red de seguridad de concurrencia), pero permite estados intermedios.
-- Los pedidos sin ruta (ruta_id NULL) no chocan entre si, igual que con el indice parcial anterior.

DROP INDEX uq_pedido_ruta_orden;

ALTER TABLE pedido
    ADD CONSTRAINT uq_pedido_ruta_orden UNIQUE (ruta_id, orden_en_ruta) DEFERRABLE INITIALLY DEFERRED;
