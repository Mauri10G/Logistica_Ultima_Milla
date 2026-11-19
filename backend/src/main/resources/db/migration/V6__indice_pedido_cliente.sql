-- pedido.cliente_id es clave foranea hacia cliente pero no tenia indice: borrar un cliente o buscar los pedidos de un
-- cliente recorria la tabla de pedidos completa. Con unos 760 000 clientes de prueba, borrarlos no terminaba en mas de
-- 10 minutos; con el indice tarda segundos (#45).
CREATE INDEX idx_pedido_cliente ON pedido (cliente_id);
