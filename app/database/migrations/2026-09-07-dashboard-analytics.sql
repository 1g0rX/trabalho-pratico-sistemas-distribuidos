-- CreateJoy - indicadores do dashboard da Supervisão/Admin
-- Migração aditiva e idempotente: nenhum aluno ou outro cadastro é removido ou recriado.

SET NAMES utf8mb4;

SET @has_student_gender := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'students'
      AND column_name = 'gender'
);

SET @sql_student_gender := IF(
    @has_student_gender = 0,
    'ALTER TABLE students ADD COLUMN gender VARCHAR(20) NULL AFTER birth_date',
    'SELECT 1'
);

PREPARE stmt_student_gender FROM @sql_student_gender;
EXECUTE stmt_student_gender;
DEALLOCATE PREPARE stmt_student_gender;

-- Os alunos que já existiam permanecem com gênero não informado até serem editados.
INSERT INTO schema_migrations (version, description)
VALUES (
    '2026.09.07-dashboard-analytics',
    'Campo de gênero dos alunos e indicadores de alunos e solicitações da CreateStore'
)
ON DUPLICATE KEY UPDATE description = VALUES(description);
