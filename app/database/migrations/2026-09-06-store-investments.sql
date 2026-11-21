-- CreateJoy - estoque da CreateStore e Carteira de Investimentos educativa
-- Migração aditiva e idempotente: preserva todos os usuários, saldos, pedidos e cadastros existentes.

SET NAMES utf8mb4;

SET @has_inventory_mode := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'store_products' AND column_name = 'inventory_mode'
);
SET @sql_inventory_mode := IF(
    @has_inventory_mode = 0,
    'ALTER TABLE store_products ADD COLUMN inventory_mode VARCHAR(20) NOT NULL DEFAULT ''limited'' AFTER image_path',
    'SELECT 1'
);
PREPARE stmt_inventory_mode FROM @sql_inventory_mode;
EXECUTE stmt_inventory_mode;
DEALLOCATE PREPARE stmt_inventory_mode;

SET @has_stock_quantity := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'store_products' AND column_name = 'stock_quantity'
);
SET @sql_stock_quantity := IF(
    @has_stock_quantity = 0,
    'ALTER TABLE store_products ADD COLUMN stock_quantity INT UNSIGNED NULL AFTER inventory_mode',
    'SELECT 1'
);
PREPARE stmt_stock_quantity FROM @sql_stock_quantity;
EXECUTE stmt_stock_quantity;
DEALLOCATE PREPARE stmt_stock_quantity;

-- O catálogo padrão permanece ilimitado. Produtos exclusivos cadastrados depois mantêm seu próprio estoque.
UPDATE store_products
SET inventory_mode = 'unlimited', stock_quantity = NULL
WHERE name IN (
    'Bala', 'Caixa de bombons', 'Impressão 3D personalizada',
    'Mouse gamer', 'Headset gamer', 'Kit mouse e teclado gamer', 'Teclado gamer'
);

INSERT INTO store_products
    (name, description, category, price_joys, image_path, inventory_mode, stock_quantity, status, sort_order)
VALUES
    ('Teclado gamer', 'Teclado gamer avulso para trocar pelos Joys conquistados nas missões.', 'Periféricos', 1500, '/images/store/teclado-gamer.svg', 'unlimited', NULL, 'active', 7)
ON DUPLICATE KEY UPDATE
    price_joys = VALUES(price_joys),
    image_path = COALESCE(NULLIF(store_products.image_path, ''), VALUES(image_path)),
    inventory_mode = 'unlimited',
    stock_quantity = NULL;

CREATE TABLE IF NOT EXISTS investment_products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    risk_label VARCHAR(40) NOT NULL DEFAULT 'Baixo',
    monthly_rate_basis_points SMALLINT UNSIGNED NOT NULL DEFAULT 10,
    minimum_joys INT UNSIGNED NOT NULL DEFAULT 10,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_investment_products_name (name),
    KEY idx_investment_products_status_order (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_investments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    principal_joys INT UNSIGNED NOT NULL DEFAULT 0,
    accrued_joys DECIMAL(16,8) UNSIGNED NOT NULL DEFAULT 0,
    last_accrual_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_student_investments_product (student_id, product_id),
    KEY idx_student_investments_student (student_id, updated_at),
    CONSTRAINT fk_student_investments_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_investments_product
        FOREIGN KEY (product_id) REFERENCES investment_products (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS investment_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    amount_joys INT UNSIGNED NOT NULL,
    principal_after INT UNSIGNED NOT NULL,
    earnings_after DECIMAL(16,8) UNSIGNED NOT NULL DEFAULT 0,
    joy_balance_after INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_investment_transactions_student (student_id, created_at),
    CONSTRAINT fk_investment_transactions_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_investment_transactions_product
        FOREIGN KEY (product_id) REFERENCES investment_products (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO investment_products
    (name, description, risk_label, monthly_rate_basis_points, minimum_joys, status, sort_order)
VALUES
    ('Cofrinho Seguro', 'Uma opção educativa para começar com calma e observar o crescimento dos Joys ao longo do tempo.', 'Muito baixo', 10, 10, 'active', 1),
    ('Fundo Criativo', 'Uma simulação de fundo com rendimento baixo para aprender a comparar prazo, taxa e objetivo.', 'Baixo', 20, 25, 'active', 2),
    ('Projeto Maker', 'Uma opção educativa de prazo maior, ainda conservadora, para praticar planejamento e disciplina.', 'Baixo', 30, 50, 'active', 3)
ON DUPLICATE KEY UPDATE
    description = VALUES(description),
    risk_label = VALUES(risk_label),
    monthly_rate_basis_points = VALUES(monthly_rate_basis_points),
    minimum_joys = VALUES(minimum_joys),
    status = VALUES(status),
    sort_order = VALUES(sort_order);

INSERT INTO schema_migrations (version, description)
VALUES ('2026.09.06-store-investments', 'Estoque da CreateStore, teclado avulso e carteira educativa de investimentos')
ON DUPLICATE KEY UPDATE description = VALUES(description);
