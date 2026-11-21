-- CreateJoy - contratos, rematrículas, follow-ups e lembretes
-- Migração aditiva e idempotente. Esta versão pública não contém dados reais.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS student_contracts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    contract_signed_at DATE NULL,
    contract_start_date DATE NULL,
    contract_end_date DATE NULL,
    duration_months SMALLINT UNSIGNED NULL,
    payment_method VARCHAR(30) NULL,
    payment_cycle_end_date DATE NULL,
    enrollment_fee_required TINYINT(1) NULL,
    enrollment_fee_next_date DATE NULL,
    billing_action VARCHAR(30) NOT NULL DEFAULT 'none',
    contract_status VARCHAR(30) NOT NULL DEFAULT 'blank',
    renewal_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
    notes TEXT NULL,
    rescinded_at DATE NULL,
    rescission_reason VARCHAR(1000) NULL,
    legacy_payment_initial TEXT NULL,
    legacy_contract TEXT NULL,
    legacy_followup TEXT NULL,
    legacy_payment_second_semester TEXT NULL,
    legacy_status TEXT NULL,
    source_label VARCHAR(190) NULL,
    source_page SMALLINT UNSIGNED NULL,
    source_imported TINYINT(1) NOT NULL DEFAULT 0,
    created_by INT UNSIGNED NULL,
    updated_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_student_contracts_student (student_id),
    KEY idx_student_contracts_end_status (contract_end_date, contract_status),
    KEY idx_student_contracts_payment (payment_method, billing_action),
    CONSTRAINT fk_student_contracts_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_student_contracts_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_student_contracts_updater FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contract_followups (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    contact_at DATETIME NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
    sent_message TEXT NULL,
    guardian_response TEXT NULL,
    next_action TEXT NULL,
    source_key VARCHAR(190) NULL,
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_contract_followups_source (source_key),
    KEY idx_contract_followups_student_date (student_id, contact_at),
    KEY idx_contract_followups_contract (contract_id),
    CONSTRAINT fk_contract_followups_contract FOREIGN KEY (contract_id) REFERENCES student_contracts (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_contract_followups_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_contract_followups_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contract_reminders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    contract_id BIGINT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    reminder_type VARCHAR(30) NOT NULL DEFAULT 'other',
    title VARCHAR(160) NOT NULL,
    due_at DATETIME NOT NULL,
    notes VARCHAR(1000) NULL,
    financial_responsible_name VARCHAR(120) NULL,
    billing_installments TINYINT UNSIGNED NULL,
    billing_first_due_date DATE NULL,
    billing_due_day TINYINT UNSIGNED NULL,
    sponte_registered TINYINT(1) NULL,
    attachment_original_name VARCHAR(255) NULL,
    attachment_stored_name VARCHAR(255) NULL,
    attachment_mime_type VARCHAR(120) NULL,
    attachment_file_size INT UNSIGNED NULL,
    attachment_uploaded_at DATETIME NULL,
    attachment_delete_after DATE NULL,
    attachment_deleted_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at DATETIME NULL,
    completed_by INT UNSIGNED NULL,
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_contract_reminders_due_status (status, due_at),
    KEY idx_contract_reminders_attachment_cleanup (attachment_delete_after, attachment_stored_name),
    KEY idx_contract_reminders_student (student_id),
    KEY idx_contract_reminders_contract (contract_id),
    CONSTRAINT fk_contract_reminders_contract FOREIGN KEY (contract_id) REFERENCES student_contracts (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_contract_reminders_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_contract_reminders_completer FOREIGN KEY (completed_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_contract_reminders_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permissions (code, name, group_name, description, sort_order)
VALUES ('reenrollment.manage', 'Gerenciar rematrículas', 'Administração', 'Contratos, follow-ups, rescisões e lembretes de renovação.', 220)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    group_name = VALUES(group_name),
    description = VALUES(description),
    sort_order = VALUES(sort_order);

INSERT IGNORE INTO role_permissions (role_code, permission_code)
VALUES ('admin', 'reenrollment.manage'), ('supervisor', 'reenrollment.manage');

-- Alunos existentes aparecem na seção de rematrícula com cadastro em branco.
INSERT IGNORE INTO student_contracts (student_id, contract_status, renewal_status)
SELECT user_account.id, 'blank', 'not_started'
FROM users user_account
JOIN students student_profile ON student_profile.user_id = user_account.id
WHERE user_account.role = 'student';

INSERT INTO schema_migrations (version, description)
VALUES ('2026.11.03-rematricula', 'Contratos, rematrículas, follow-ups, rescisões e lembretes administrativos')
ON DUPLICATE KEY UPDATE description = VALUES(description);
