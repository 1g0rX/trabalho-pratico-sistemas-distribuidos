-- CreateJoy - taxa de matrícula na gestão de rematrículas
-- Migração aditiva e idempotente para MySQL 5.7/MariaDB.

SET NAMES utf8mb4;

SET @createjoy_database = DATABASE();

SET @createjoy_has_fee_required = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @createjoy_database
      AND TABLE_NAME = 'student_contracts'
      AND COLUMN_NAME = 'enrollment_fee_required'
);
SET @createjoy_fee_required_sql = IF(
    @createjoy_has_fee_required = 0,
    'ALTER TABLE student_contracts ADD COLUMN enrollment_fee_required TINYINT(1) NULL AFTER payment_cycle_end_date',
    'SELECT 1'
);
PREPARE createjoy_fee_required_statement FROM @createjoy_fee_required_sql;
EXECUTE createjoy_fee_required_statement;
DEALLOCATE PREPARE createjoy_fee_required_statement;

SET @createjoy_has_fee_date = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @createjoy_database
      AND TABLE_NAME = 'student_contracts'
      AND COLUMN_NAME = 'enrollment_fee_next_date'
);
SET @createjoy_fee_date_sql = IF(
    @createjoy_has_fee_date = 0,
    'ALTER TABLE student_contracts ADD COLUMN enrollment_fee_next_date DATE NULL AFTER enrollment_fee_required',
    'SELECT 1'
);
PREPARE createjoy_fee_date_statement FROM @createjoy_fee_date_sql;
EXECUTE createjoy_fee_date_statement;
DEALLOCATE PREPARE createjoy_fee_date_statement;

INSERT INTO schema_migrations (version, description)
VALUES ('2026.11.04-enrollment-fee', 'Taxa de matrícula e alertas de vencimento na rematrícula')
ON DUPLICATE KEY UPDATE description = VALUES(description);
