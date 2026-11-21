-- CreateJoy - mercado educativo com oscilações diárias
-- Migração aditiva e idempotente. Preserva saldos, aportes e retiradas existentes.

SET NAMES utf8mb4;

SET @has_symbol := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'investment_products' AND column_name = 'symbol');
SET @sql_symbol := IF(@has_symbol = 0, 'ALTER TABLE investment_products ADD COLUMN symbol VARCHAR(20) NOT NULL DEFAULT ''SIM'' AFTER risk_label', 'SELECT 1');
PREPARE stmt_symbol FROM @sql_symbol; EXECUTE stmt_symbol; DEALLOCATE PREPARE stmt_symbol;

SET @has_asset_type := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'investment_products' AND column_name = 'asset_type');
SET @sql_asset_type := IF(@has_asset_type = 0, 'ALTER TABLE investment_products ADD COLUMN asset_type VARCHAR(30) NOT NULL DEFAULT ''fund'' AFTER symbol', 'SELECT 1');
PREPARE stmt_asset_type FROM @sql_asset_type; EXECUTE stmt_asset_type; DEALLOCATE PREPARE stmt_asset_type;

SET @has_daily_drift := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'investment_products' AND column_name = 'daily_drift_basis_points');
SET @sql_daily_drift := IF(@has_daily_drift = 0, 'ALTER TABLE investment_products ADD COLUMN daily_drift_basis_points SMALLINT NOT NULL DEFAULT 2 AFTER asset_type', 'SELECT 1');
PREPARE stmt_daily_drift FROM @sql_daily_drift; EXECUTE stmt_daily_drift; DEALLOCATE PREPARE stmt_daily_drift;

SET @has_daily_volatility := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'investment_products' AND column_name = 'daily_volatility_basis_points');
SET @sql_daily_volatility := IF(@has_daily_volatility = 0, 'ALTER TABLE investment_products ADD COLUMN daily_volatility_basis_points SMALLINT UNSIGNED NOT NULL DEFAULT 50 AFTER daily_drift_basis_points', 'SELECT 1');
PREPARE stmt_daily_volatility FROM @sql_daily_volatility; EXECUTE stmt_daily_volatility; DEALLOCATE PREPARE stmt_daily_volatility;

SET @has_market_seed := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'investment_products' AND column_name = 'market_seed');
SET @sql_market_seed := IF(@has_market_seed = 0, 'ALTER TABLE investment_products ADD COLUMN market_seed INT UNSIGNED NOT NULL DEFAULT 1 AFTER daily_volatility_basis_points', 'SELECT 1');
PREPARE stmt_market_seed FROM @sql_market_seed; EXECUTE stmt_market_seed; DEALLOCATE PREPARE stmt_market_seed;

SET @has_anchor_date := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'investment_products' AND column_name = 'market_anchor_date');
SET @sql_anchor_date := IF(@has_anchor_date = 0, 'ALTER TABLE investment_products ADD COLUMN market_anchor_date DATE NULL AFTER market_seed', 'SELECT 1');
PREPARE stmt_anchor_date FROM @sql_anchor_date; EXECUTE stmt_anchor_date; DEALLOCATE PREPARE stmt_anchor_date;

SET @has_anchor_price := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'investment_products' AND column_name = 'market_anchor_price');
SET @sql_anchor_price := IF(@has_anchor_price = 0, 'ALTER TABLE investment_products ADD COLUMN market_anchor_price DECIMAL(16,6) UNSIGNED NOT NULL DEFAULT 100 AFTER market_anchor_date', 'SELECT 1');
PREPARE stmt_anchor_price FROM @sql_anchor_price; EXECUTE stmt_anchor_price; DEALLOCATE PREPARE stmt_anchor_price;

SET @has_units := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'student_investments' AND column_name = 'units');
SET @sql_units := IF(@has_units = 0, 'ALTER TABLE student_investments ADD COLUMN units DECIMAL(24,10) UNSIGNED NULL AFTER accrued_joys', 'SELECT 1');
PREPARE stmt_units FROM @sql_units; EXECUTE stmt_units; DEALLOCATE PREPARE stmt_units;

UPDATE investment_products SET
    description = 'Ativo simulado com pequenas oscilações para começar e aprender a acompanhar uma cotação.',
    risk_label = 'Muito baixo', symbol = 'CJSF', asset_type = 'fixed_income',
    daily_drift_basis_points = 3, daily_volatility_basis_points = 35, market_seed = 1103,
    market_anchor_date = COALESCE(market_anchor_date, CURRENT_DATE), market_anchor_price = 100,
    minimum_joys = 10, sort_order = 1
WHERE name = 'Cofrinho Seguro';

UPDATE investment_products SET
    description = 'Fundo simulado diversificado, com variações moderadas ao longo dos dias e das semanas.',
    risk_label = 'Baixo', symbol = 'CJFD', asset_type = 'fund',
    daily_drift_basis_points = 5, daily_volatility_basis_points = 100, market_seed = 2207,
    market_anchor_date = COALESCE(market_anchor_date, CURRENT_DATE), market_anchor_price = 100,
    minimum_joys = 25, sort_order = 2
WHERE name = 'Fundo Criativo';

UPDATE investment_products SET
    description = 'Carteira simulada de empresas de inovação e fabricação digital, com oscilações mais visíveis.',
    risk_label = 'Moderado', symbol = 'MKRS', asset_type = 'stocks',
    daily_drift_basis_points = 7, daily_volatility_basis_points = 180, market_seed = 3301,
    market_anchor_date = COALESCE(market_anchor_date, CURRENT_DATE), market_anchor_price = 100,
    minimum_joys = 50, sort_order = 3
WHERE name = 'Projeto Maker';

INSERT INTO investment_products
    (name, description, risk_label, symbol, asset_type, daily_drift_basis_points,
     daily_volatility_basis_points, market_seed, market_anchor_date, market_anchor_price,
     monthly_rate_basis_points, minimum_joys, status, sort_order)
VALUES
    ('Ações de Tecnologia', 'Índice educativo de ações de tecnologia. Pode subir ou cair diariamente e não representa empresas reais.', 'Moderado/alto', 'TECH', 'stocks', 10, 280, 4409, CURRENT_DATE, 100, 0, 30, 'active', 4),
    ('Energia Verde', 'Fundo educativo ligado a projetos sustentáveis, com valorização e desvalorização simuladas.', 'Moderado', 'ECO', 'etf', 7, 200, 5519, CURRENT_DATE, 100, 0, 30, 'active', 5),
    ('Bitcoin Simulado', 'Criptoativo exclusivamente educativo, com oscilações fortes. Não acompanha o preço do Bitcoin real.', 'Alto', 'BTC-SIM', 'crypto', 12, 650, 6629, CURRENT_DATE, 100, 0, 20, 'active', 6)
ON DUPLICATE KEY UPDATE
    description = VALUES(description), risk_label = VALUES(risk_label), symbol = VALUES(symbol),
    asset_type = VALUES(asset_type), daily_drift_basis_points = VALUES(daily_drift_basis_points),
    daily_volatility_basis_points = VALUES(daily_volatility_basis_points), market_seed = VALUES(market_seed),
    market_anchor_date = COALESCE(investment_products.market_anchor_date, VALUES(market_anchor_date)),
    market_anchor_price = VALUES(market_anchor_price), minimum_joys = VALUES(minimum_joys),
    status = VALUES(status), sort_order = VALUES(sort_order);

-- Converte o valor antigo em cotas de 100 Joys sem alterar o total disponível.
UPDATE student_investments position_row
JOIN investment_products product ON product.id = position_row.product_id
SET position_row.units = (position_row.principal_joys + position_row.accrued_joys) / product.market_anchor_price
WHERE (position_row.units IS NULL OR position_row.units = 0)
  AND (position_row.principal_joys > 0 OR position_row.accrued_joys > 0);

INSERT INTO schema_migrations (version, description)
VALUES ('2026.09.08-investment-market', 'Mercado educativo com cotas, oscilações diárias e novos ativos simulados')
ON DUPLICATE KEY UPDATE description = VALUES(description);
