-- CreateJoy - migração da CreateStore
-- Pode ser executada uma única vez em bancos que já usam o esquema v2.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS store_products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    category VARCHAR(60) NOT NULL DEFAULT 'Impressão 3D',
    price_joys INT UNSIGNED NOT NULL,
    image_path VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_products_name (name),
    KEY idx_store_products_status_order (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_purchase_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    product_name VARCHAR(120) NOT NULL,
    total_joys INT UNSIGNED NOT NULL,
    request_details TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by INT UNSIGNED NULL,
    review_notes VARCHAR(1000) NULL,
    joy_transaction_id BIGINT UNSIGNED NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_request_joy_transaction (joy_transaction_id),
    KEY idx_store_requests_status_date (status, requested_at),
    KEY idx_store_requests_student_date (student_id, requested_at),
    KEY idx_store_requests_product (product_id),
    KEY idx_store_requests_reviewer (reviewed_by),
    CONSTRAINT fk_store_requests_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_store_requests_product
        FOREIGN KEY (product_id) REFERENCES store_products (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_store_requests_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_store_requests_joy_transaction
        FOREIGN KEY (joy_transaction_id) REFERENCES joy_transactions (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permissions (code, name, group_name, description, sort_order)
VALUES ('store.manage', 'Analisar solicitações da loja', 'Loja', '', 210)
ON DUPLICATE KEY UPDATE name = VALUES(name), group_name = VALUES(group_name), sort_order = VALUES(sort_order);

INSERT IGNORE INTO role_permissions (role_code, permission_code) VALUES
    ('supervisor', 'store.manage'),
    ('admin', 'store.manage');

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
VALUES ('2026.08.11-store-catalog', 'CreateStore com catálogo, solicitações e pagamento em Joys')
ON DUPLICATE KEY UPDATE description = VALUES(description);
