-- CreateJoy - perfis Financeiro e Gestão Administrativa
-- Atualização aditiva e idempotente: não apaga nem substitui dados existentes.

SET NAMES utf8mb4;

-- Dados operacionais e arquivo protegido das tarefas de carnê/boleto.
-- Cada coluna é adicionada somente se ainda não existir, permitindo reimportar
-- esta atualização com segurança depois da primeira versão dos novos perfis.

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'financial_responsible_name') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN financial_responsible_name VARCHAR(120) NULL AFTER notes',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'billing_installments') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN billing_installments TINYINT UNSIGNED NULL AFTER financial_responsible_name',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'billing_first_due_date') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN billing_first_due_date DATE NULL AFTER billing_installments',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'billing_due_day') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN billing_due_day TINYINT UNSIGNED NULL AFTER billing_first_due_date',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'sponte_registered') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN sponte_registered TINYINT(1) NULL AFTER billing_due_day',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'attachment_original_name') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN attachment_original_name VARCHAR(255) NULL AFTER sponte_registered',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'attachment_stored_name') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN attachment_stored_name VARCHAR(255) NULL AFTER attachment_original_name',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'attachment_mime_type') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN attachment_mime_type VARCHAR(120) NULL AFTER attachment_stored_name',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'attachment_file_size') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN attachment_file_size INT UNSIGNED NULL AFTER attachment_mime_type',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'attachment_uploaded_at') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN attachment_uploaded_at DATETIME NULL AFTER attachment_file_size',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'attachment_delete_after') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN attachment_delete_after DATE NULL AFTER attachment_uploaded_at',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND COLUMN_NAME = 'attachment_deleted_at') = 0,
    'ALTER TABLE contract_reminders ADD COLUMN attachment_deleted_at DATETIME NULL AFTER attachment_delete_after',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_reminders' AND INDEX_NAME = 'idx_contract_reminders_attachment_cleanup') = 0,
    'ALTER TABLE contract_reminders ADD INDEX idx_contract_reminders_attachment_cleanup (attachment_delete_after, attachment_stored_name)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO roles (code, name, description, is_system, sort_order) VALUES
    ('finance', 'Financeiro', 'Conclui tarefas de emissão de carnês, boletos e taxas de matrícula.', 1, 5),
    ('administrative', 'Gestão Administrativa', 'Acessa rematrículas, funcionários, alunos, administração e permissões.', 1, 6)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_system = VALUES(is_system),
    sort_order = VALUES(sort_order);

INSERT INTO permissions (code, name, group_name, description, sort_order) VALUES
    ('reenrollment.manage', 'Gerenciar rematrículas', 'Administração', 'Contratos, follow-ups, rescisões e lembretes de renovação.', 220),
    ('reenrollment.financial', 'Concluir tarefas financeiras', 'Rematrícula', 'Permite concluir somente tarefas de carnê, boleto e taxa de matrícula.', 221)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    group_name = VALUES(group_name),
    description = VALUES(description),
    sort_order = VALUES(sort_order);

INSERT IGNORE INTO role_permissions (role_code, permission_code) VALUES
    ('finance', 'dashboard.view_own'),
    ('finance', 'profile.edit_own'),
    ('finance', 'reenrollment.financial'),
    ('administrative', 'dashboard.view_own'),
    ('administrative', 'profile.edit_own'),
    ('administrative', 'reenrollment.manage'),
    ('administrative', 'teachers.manage'),
    ('administrative', 'students.manage'),
    ('administrative', 'curriculum.manage'),
    ('administrative', 'missions.manage'),
    ('administrative', 'permissions.manage'),
    ('administrative', 'audit.view'),
    ('admin', 'reenrollment.financial');

INSERT INTO schema_migrations (version, description)
VALUES ('2026.11.09-access-profiles', 'Perfis Financeiro e Gestão Administrativa, tarefas de boleto e PDFs protegidos')
ON DUPLICATE KEY UPDATE description = VALUES(description);
