-- CreateJoy - jornada real do aluno, checklist e imagens da CreateStore
-- Migração aditiva: não apaga nem altera cadastros, entregas ou saldos existentes.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS student_module_completions (
    student_id INT UNSIGNED NOT NULL,
    module_id INT UNSIGNED NOT NULL,
    completion_type VARCHAR(20) NOT NULL DEFAULT 'recognized',
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by INT UNSIGNED NULL,
    notes VARCHAR(500) NOT NULL DEFAULT '',
    PRIMARY KEY (student_id, module_id),
    KEY idx_student_module_completions_module (module_id),
    CONSTRAINT fk_student_module_completions_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_module_completions_module
        FOREIGN KEY (module_id) REFERENCES modules (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_module_completions_recorder
        FOREIGN KEY (recorded_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_activity_progress (
    student_id INT UNSIGNED NOT NULL,
    activity_id INT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, activity_id),
    KEY idx_student_activity_progress_status (student_id, status),
    CONSTRAINT fk_student_activity_progress_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_activity_progress_activity
        FOREIGN KEY (activity_id) REFERENCES activities (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_prerequisites (
    activity_id INT UNSIGNED NOT NULL,
    prerequisite_activity_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (activity_id, prerequisite_activity_id),
    CONSTRAINT fk_activity_prerequisites_activity
        FOREIGN KEY (activity_id) REFERENCES activities (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_activity_prerequisites_required
        FOREIGN KEY (prerequisite_activity_id) REFERENCES activities (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE store_products
SET image_path = CASE name
    WHEN 'Bala' THEN '/images/store/bala.png'
    WHEN 'Caixa de bombons' THEN '/images/store/caixa-bombons.png'
    WHEN 'Impressão 3D personalizada' THEN '/images/store/impressao-3d.png'
    WHEN 'Mouse gamer' THEN '/images/store/mouse-gamer.png'
    WHEN 'Headset gamer' THEN '/images/store/headset-gamer.png'
    WHEN 'Kit mouse e teclado gamer' THEN '/images/store/kit-mouse-teclado.png'
    ELSE image_path
END
WHERE name IN (
    'Bala', 'Caixa de bombons', 'Impressão 3D personalizada',
    'Mouse gamer', 'Headset gamer', 'Kit mouse e teclado gamer'
);

INSERT INTO schema_migrations (version, description)
VALUES ('2026.08.21-student-learning-flow', 'Jornada por módulo real, checklist de atividades e imagens da CreateStore')
ON DUPLICATE KEY UPDATE description = VALUES(description);
