-- CreateJoy - ampliação do catálogo da CreateStore
-- Execute em bancos que já receberam a migração 2026-08-11-store.sql.

SET NAMES utf8mb4;

INSERT INTO store_products (name, description, category, price_joys, status, sort_order)
VALUES
    ('Bala', 'Uma bala sortida por solicitação, conforme a disponibilidade da unidade.', 'Guloseimas', 1, 'active', 1),
    ('Caixa de bombons', 'Uma caixa de bombons para trocar pelos Joys conquistados nas missões.', 'Guloseimas', 300, 'active', 2),
    ('Impressão 3D personalizada', 'Solicite a produção de uma peça ou chaveiro personalizado em impressão 3D.', 'Impressão 3D', 300, 'active', 3),
    ('Mouse gamer', 'Mouse gamer disponível conforme o modelo e o estoque da unidade.', 'Periféricos', 1500, 'active', 4),
    ('Headset gamer', 'Headset gamer disponível conforme o modelo e o estoque da unidade.', 'Periféricos', 2500, 'active', 5),
    ('Kit mouse e teclado gamer', 'Kit com mouse e teclado gamer, sujeito à disponibilidade da unidade.', 'Periféricos', 3000, 'active', 6)
ON DUPLICATE KEY UPDATE description = VALUES(description), category = VALUES(category),
    price_joys = VALUES(price_joys), status = 'active', sort_order = VALUES(sort_order);

INSERT INTO schema_migrations (version, description)
VALUES ('2026.08.11-store-catalog', 'Ampliação da CreateStore para seis produtos')
ON DUPLICATE KEY UPDATE description = VALUES(description);
