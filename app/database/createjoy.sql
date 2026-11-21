-- CreateJoy - banco de dados completo
-- MySQL 8+ / MariaDB 10.4+
-- Este arquivo cria uma instalação limpa, sem alunos, professores, turmas,
-- módulos, missões ou entregas de demonstração.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS store_purchase_requests;
DROP TABLE IF EXISTS pedagogical_notes;
DROP TABLE IF EXISTS joy_transactions;
DROP TABLE IF EXISTS store_products;
DROP TABLE IF EXISTS student_medals;
DROP TABLE IF EXISTS medals;
DROP TABLE IF EXISTS submission_comments;
DROP TABLE IF EXISTS submission_files;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS mission_notes;
DROP TABLE IF EXISTS student_missions;
DROP TABLE IF EXISTS student_activity_progress;
DROP TABLE IF EXISTS activity_support_files;
DROP TABLE IF EXISTS activity_prerequisites;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS mission_support_files;
DROP TABLE IF EXISTS mission_prerequisites;
DROP TABLE IF EXISTS mission_steps;
DROP TABLE IF EXISTS missions;
DROP TABLE IF EXISTS student_materials;
DROP TABLE IF EXISTS student_kit_assignments;
DROP TABLE IF EXISTS lab_kit_items;
DROP TABLE IF EXISTS lab_kits;
DROP TABLE IF EXISTS student_transfers;
DROP TABLE IF EXISTS class_enrollments;
DROP TABLE IF EXISTS class_modules;
DROP TABLE IF EXISTS student_module_completions;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS teacher_profiles;
DROP TABLE IF EXISTS class_schedules;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS modules;
DROP TABLE IF EXISTS curriculum_levels;
DROP TABLE IF EXISTS semesters;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS user_permission_overrides;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS schema_migrations;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE schema_migrations (
    version VARCHAR(40) NOT NULL,
    description VARCHAR(190) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE app_settings (
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    value_type VARCHAR(20) NOT NULL DEFAULT 'string',
    description VARCHAR(255) NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    category VARCHAR(60) NOT NULL DEFAULT 'Impressão 3D',
    price_joys INT UNSIGNED NOT NULL,
    image_path VARCHAR(255) NULL,
    inventory_mode VARCHAR(20) NOT NULL DEFAULT 'limited',
    stock_quantity INT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_products_name (name),
    KEY idx_store_products_status_order (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    code VARCHAR(30) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    is_system TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (code),
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    avatar_path VARCHAR(255) NULL,
    avatar_mime_type VARCHAR(120) NULL,
    avatar_file_size INT UNSIGNED NULL,
    phone VARCHAR(30) NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    password_changed_at DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role_status (role, status),
    CONSTRAINT fk_users_role
        FOREIGN KEY (role) REFERENCES roles (code)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
    code VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    group_name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (code),
    UNIQUE KEY uq_permissions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
    role_code VARCHAR(30) NOT NULL,
    permission_code VARCHAR(80) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_code, permission_code),
    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_code) REFERENCES roles (code)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_code) REFERENCES permissions (code)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_permission_overrides (
    user_id INT UNSIGNED NOT NULL,
    permission_code VARCHAR(80) NOT NULL,
    allowed TINYINT(1) NOT NULL,
    granted_by INT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_code),
    KEY idx_user_permission_granter (granted_by),
    CONSTRAINT fk_user_permission_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_user_permission_permission
        FOREIGN KEY (permission_code) REFERENCES permissions (code)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_user_permission_granter
        FOREIGN KEY (granted_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_password_reset_token (token_hash),
    KEY idx_password_reset_user (user_id, expires_at),
    CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE semesters (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'planned',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_semesters_name (name),
    KEY idx_semesters_status_dates (status, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE curriculum_levels (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(60) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL,
    default_color CHAR(7) NOT NULL DEFAULT '#1E72B8',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    PRIMARY KEY (id),
    UNIQUE KEY uq_curriculum_levels_code (code),
    UNIQUE KEY uq_curriculum_levels_name (name),
    UNIQUE KEY uq_curriculum_levels_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modules (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    curriculum_level_id SMALLINT UNSIGNED NULL,
    name VARCHAR(100) NOT NULL,
    level SMALLINT UNSIGNED NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    workload_hours SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    color CHAR(7) NOT NULL DEFAULT '#1E72B8',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_modules_name (name),
    UNIQUE KEY uq_modules_level (level),
    KEY idx_modules_curriculum_level (curriculum_level_id),
    CONSTRAINT fk_modules_curriculum_level
        FOREIGN KEY (curriculum_level_id) REFERENCES curriculum_levels (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    semester_id INT UNSIGNED NULL,
    code VARCHAR(40) NULL,
    name VARCHAR(120) NOT NULL,
    teacher_user_id INT UNSIGNED NULL,
    schedule VARCHAR(190) NOT NULL DEFAULT '',
    room VARCHAR(100) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_classes_name (name),
    UNIQUE KEY uq_classes_code (code),
    KEY idx_classes_semester (semester_id),
    KEY idx_classes_teacher (teacher_user_id),
    CONSTRAINT fk_classes_semester
        FOREIGN KEY (semester_id) REFERENCES semesters (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_classes_teacher
        FOREIGN KEY (teacher_user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE class_schedules (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    class_id INT UNSIGNED NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(100) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_class_schedule (class_id, weekday, start_time),
    KEY idx_class_schedules_class (class_id),
    CONSTRAINT fk_class_schedules_class
        FOREIGN KEY (class_id) REFERENCES classes (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teacher_profiles (
    user_id INT UNSIGNED NOT NULL,
    specialization VARCHAR(190) NOT NULL DEFAULT '',
    biography TEXT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_teacher_profiles_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
    user_id INT UNSIGNED NOT NULL,
    class_id INT UNSIGNED NULL,
    current_module_id INT UNSIGNED NULL,
    current_semester_id INT UNSIGNED NULL,
    enrollment_number VARCHAR(50) NULL,
    birth_date DATE NULL,
    gender VARCHAR(20) NULL,
    guardian_name VARCHAR(120) NULL,
    guardian_phone VARCHAR(30) NULL,
    computer_number VARCHAR(20) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    lab_notes TEXT NULL,
    joy_balance INT NOT NULL DEFAULT 0,
    enrolled_at DATE NULL,
    left_at DATE NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_students_enrollment (enrollment_number),
    KEY idx_students_class (class_id),
    KEY idx_students_module (current_module_id),
    KEY idx_students_semester (current_semester_id),
    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_students_class
        FOREIGN KEY (class_id) REFERENCES classes (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_students_module
        FOREIGN KEY (current_module_id) REFERENCES modules (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_students_semester
        FOREIGN KEY (current_semester_id) REFERENCES semesters (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_module_completions (
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

CREATE TABLE class_modules (
    class_id INT UNSIGNED NOT NULL,
    module_id INT UNSIGNED NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    available_from DATE NULL,
    available_until DATE NULL,
    PRIMARY KEY (class_id, module_id),
    KEY idx_class_modules_order (class_id, sort_order),
    CONSTRAINT fk_class_modules_class
        FOREIGN KEY (class_id) REFERENCES classes (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_class_modules_module
        FOREIGN KEY (module_id) REFERENCES modules (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE class_enrollments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    class_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    semester_id INT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    enrolled_at DATE NOT NULL,
    ended_at DATE NULL,
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_enrollments_class_status (class_id, status),
    KEY idx_enrollments_student_status (student_id, status),
    CONSTRAINT fk_enrollments_class
        FOREIGN KEY (class_id) REFERENCES classes (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_semester
        FOREIGN KEY (semester_id) REFERENCES semesters (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_enrollments_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_transfers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    from_class_id INT UNSIGNED NULL,
    to_class_id INT UNSIGNED NOT NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    transferred_by INT UNSIGNED NULL,
    transferred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_student_transfers_student (student_id, transferred_at),
    CONSTRAINT fk_student_transfers_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_transfers_from_class
        FOREIGN KEY (from_class_id) REFERENCES classes (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_student_transfers_to_class
        FOREIGN KEY (to_class_id) REFERENCES classes (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_student_transfers_user
        FOREIGN KEY (transferred_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lab_kits (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(50) NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_lab_kits_code (code),
    UNIQUE KEY uq_lab_kits_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lab_kit_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    kit_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    notes VARCHAR(255) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    KEY idx_lab_kit_items_kit (kit_id),
    CONSTRAINT fk_lab_kit_items_kit
        FOREIGN KEY (kit_id) REFERENCES lab_kits (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_kit_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    kit_id INT UNSIGNED NOT NULL,
    module_id INT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    returned_at DATETIME NULL,
    assigned_by INT UNSIGNED NULL,
    notes VARCHAR(500) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    KEY idx_student_kits_student_status (student_id, status),
    CONSTRAINT fk_student_kits_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_kits_kit
        FOREIGN KEY (kit_id) REFERENCES lab_kits (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_student_kits_module
        FOREIGN KEY (module_id) REFERENCES modules (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_student_kits_assigner
        FOREIGN KEY (assigned_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_materials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    notes VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_student_materials_student (student_id, status),
    CONSTRAINT fk_student_materials_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE missions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    module_id INT UNSIGNED NOT NULL,
    source_mission_id INT UNSIGNED NULL,
    title VARCHAR(160) NOT NULL,
    objective VARCHAR(500) NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    lesson_number SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    type VARCHAR(20) NOT NULL DEFAULT 'required',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    delivery_type VARCHAR(20) NOT NULL DEFAULT 'text',
    steps_json LONGTEXT NULL,
    joys_reward SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    available_from DATETIME NULL,
    available_until DATETIME NULL,
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_missions_module_order (module_id, sort_order),
    KEY idx_missions_status (status),
    KEY idx_missions_source (source_mission_id),
    CONSTRAINT fk_missions_module
        FOREIGN KEY (module_id) REFERENCES modules (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_missions_source
        FOREIGN KEY (source_mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_missions_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mission_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    mission_id INT UNSIGNED NOT NULL,
    step_order SMALLINT UNSIGNED NOT NULL,
    instruction TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mission_steps_order (mission_id, step_order),
    CONSTRAINT fk_mission_steps_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mission_prerequisites (
    mission_id INT UNSIGNED NOT NULL,
    prerequisite_mission_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (mission_id, prerequisite_mission_id),
    CONSTRAINT fk_mission_prerequisites_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_mission_prerequisites_required
        FOREIGN KEY (prerequisite_mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mission_support_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    mission_id INT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
    file_size INT UNSIGNED NOT NULL,
    file_type VARCHAR(30) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mission_support_stored (stored_name),
    KEY idx_mission_support_mission (mission_id, sort_order),
    CONSTRAINT fk_mission_support_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activities (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    mission_id INT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'exercise',
    delivery_type VARCHAR(20) NOT NULL DEFAULT 'text',
    criteria VARCHAR(500) NOT NULL DEFAULT '',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_activities_mission_order (mission_id, sort_order),
    CONSTRAINT fk_activities_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_prerequisites (
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

CREATE TABLE activity_support_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    activity_id INT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
    file_size INT UNSIGNED NOT NULL,
    file_type VARCHAR(30) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_activity_support_stored (stored_name),
    KEY idx_activity_support_activity (activity_id),
    CONSTRAINT fk_activity_support_activity
        FOREIGN KEY (activity_id) REFERENCES activities (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_missions (
    student_id INT UNSIGNED NOT NULL,
    mission_id INT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    grade VARCHAR(80) NULL,
    started_at DATETIME NULL,
    available_at DATETIME NULL,
    submitted_at DATETIME NULL,
    approved_at DATETIME NULL,
    completed_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, mission_id),
    KEY idx_student_missions_status (status),
    CONSTRAINT fk_student_missions_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_missions_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_activity_progress (
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

CREATE TABLE mission_notes (
    student_id INT UNSIGNED NOT NULL,
    mission_id INT UNSIGNED NOT NULL,
    notes TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, mission_id),
    CONSTRAINT fk_mission_notes_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_mission_notes_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    mission_id INT UNSIGNED NOT NULL,
    attempt_number SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    notes TEXT NULL,
    learned TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    feedback TEXT NULL,
    reviewed_by INT UNSIGNED NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_submissions_attempt (student_id, mission_id, attempt_number),
    KEY idx_submissions_status_date (status, submitted_at),
    KEY idx_submissions_student_mission (student_id, mission_id),
    KEY idx_submissions_reviewer (reviewed_by),
    CONSTRAINT fk_submissions_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_submissions_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_submissions_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE submission_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    submission_id BIGINT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
    file_size INT UNSIGNED NOT NULL,
    file_type VARCHAR(30) NOT NULL,
    file_hash CHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_submission_files_stored (stored_name),
    KEY idx_submission_files_submission (submission_id),
    KEY idx_submission_files_hash (file_hash),
    CONSTRAINT fk_submission_files_submission
        FOREIGN KEY (submission_id) REFERENCES submissions (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE submission_comments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    submission_id BIGINT UNSIGNED NOT NULL,
    author_user_id INT UNSIGNED NOT NULL,
    comment TEXT NOT NULL,
    is_internal TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_submission_comments_submission (submission_id, created_at),
    CONSTRAINT fk_submission_comments_submission
        FOREIGN KEY (submission_id) REFERENCES submissions (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_submission_comments_author
        FOREIGN KEY (author_user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medals (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    icon VARCHAR(30) NOT NULL DEFAULT '🏅',
    image_path VARCHAR(255) NULL,
    criteria_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    criteria_value INT UNSIGNED NULL,
    joys_reward SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_medals_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_medals (
    student_id INT UNSIGNED NOT NULL,
    medal_id INT UNSIGNED NOT NULL,
    granted_by INT UNSIGNED NULL,
    notes VARCHAR(500) NOT NULL DEFAULT '',
    earned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, medal_id),
    CONSTRAINT fk_student_medals_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_medals_medal
        FOREIGN KEY (medal_id) REFERENCES medals (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_medals_granter
        FOREIGN KEY (granted_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE joy_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    mission_id INT UNSIGNED NULL,
    medal_id INT UNSIGNED NULL,
    created_by INT UNSIGNED NULL,
    reference_key VARCHAR(120) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_joy_transactions_reference (reference_key),
    KEY idx_joy_transactions_student (student_id, created_at),
    CONSTRAINT fk_joy_transactions_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_joy_transactions_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_joy_transactions_medal
        FOREIGN KEY (medal_id) REFERENCES medals (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_joy_transactions_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_purchase_requests (
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

CREATE TABLE investment_products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    risk_label VARCHAR(40) NOT NULL DEFAULT 'Baixo',
    symbol VARCHAR(20) NOT NULL DEFAULT 'SIM',
    asset_type VARCHAR(30) NOT NULL DEFAULT 'fund',
    daily_drift_basis_points SMALLINT NOT NULL DEFAULT 2,
    daily_volatility_basis_points SMALLINT UNSIGNED NOT NULL DEFAULT 50,
    market_seed INT UNSIGNED NOT NULL DEFAULT 1,
    market_anchor_date DATE NULL,
    market_anchor_price DECIMAL(16,6) UNSIGNED NOT NULL DEFAULT 100,
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

CREATE TABLE student_investments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    principal_joys INT UNSIGNED NOT NULL DEFAULT 0,
    accrued_joys DECIMAL(16,8) UNSIGNED NOT NULL DEFAULT 0,
    units DECIMAL(24,10) UNSIGNED NULL,
    last_accrual_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_student_investments_product (student_id, product_id),
    KEY idx_student_investments_student (student_id, updated_at),
    CONSTRAINT fk_student_investments_student FOREIGN KEY (student_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_student_investments_product FOREIGN KEY (product_id) REFERENCES investment_products (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE investment_transactions (
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
    CONSTRAINT fk_investment_transactions_student FOREIGN KEY (student_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_investment_transactions_product FOREIGN KEY (product_id) REFERENCES investment_products (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pedagogical_notes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id INT UNSIGNED NOT NULL,
    author_user_id INT UNSIGNED NOT NULL,
    class_id INT UNSIGNED NULL,
    note TEXT NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'staff',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pedagogical_notes_student (student_id, created_at),
    CONSTRAINT fk_pedagogical_notes_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pedagogical_notes_author
        FOREIGN KEY (author_user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pedagogical_notes_class
        FOREIGN KEY (class_id) REFERENCES classes (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80) NULL,
    details_json LONGTEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_logs_entity (entity_type, entity_id),
    KEY idx_audit_logs_user_date (user_id, created_at),
    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configurações reais do sistema, sem conteúdo pedagógico ou usuários fictícios.
INSERT INTO app_settings (setting_key, setting_value, value_type, description) VALUES
    ('uploads.max_files_per_submission', '3', 'integer', 'Quantidade máxima de arquivos em cada tentativa'),
    ('uploads.max_total_bytes_per_submission', '8388608', 'integer', 'Limite total de 8 MB por tentativa'),
    ('uploads.max_image_bytes', '1572864', 'integer', 'Limite de 1,5 MB para imagens'),
    ('storage.warning_percent', '70', 'integer', 'Primeiro alerta de armazenamento'),
    ('storage.critical_percent', '90', 'integer', 'Alerta crítico de armazenamento');

INSERT INTO roles (code, name, description, sort_order) VALUES
    ('student', 'Aluno', 'Acessa a própria jornada e envia missões', 1),
    ('teacher', 'Professor', 'Acompanha turmas e avalia entregas', 2),
    ('supervisor', 'Supervisão', 'Gerencia a operação pedagógica', 3),
    ('admin', 'Admin Geral', 'Controla todo o sistema e as permissões', 4),
    ('finance', 'Financeiro', 'Conclui tarefas de emissão de carnês, boletos e taxas de matrícula', 5),
    ('administrative', 'Gestão Administrativa', 'Acessa rematrículas, funcionários, alunos, administração e permissões', 6);

INSERT INTO permissions (code, name, group_name, description, sort_order) VALUES
    ('dashboard.view_own', 'Ver o próprio dashboard', 'Dashboard', '', 10),
    ('journey.view_own', 'Ver a própria jornada', 'Aluno', '', 20),
    ('mission.submit', 'Enviar missões', 'Aluno', '', 30),
    ('files.view_own', 'Ver os próprios arquivos', 'Aluno', '', 40),
    ('lab.manage_own', 'Editar o próprio laboratório', 'Aluno', '', 50),
    ('profile.edit_own', 'Editar o próprio perfil', 'Perfil', '', 60),
    ('classes.view_assigned', 'Ver turmas vinculadas', 'Professor', '', 70),
    ('students.view_assigned', 'Ver alunos vinculados', 'Professor', '', 80),
    ('submissions.review', 'Corrigir entregas', 'Professor', '', 90),
    ('feedback.create', 'Enviar feedback', 'Professor', '', 100),
    ('curriculum.manage', 'Gerenciar estrutura curricular', 'Gestão', '', 110),
    ('missions.manage', 'Gerenciar missões', 'Gestão', '', 120),
    ('activities.manage', 'Gerenciar atividades', 'Gestão', '', 130),
    ('teachers.manage', 'Gerenciar professores', 'Gestão', '', 140),
    ('students.manage', 'Gerenciar alunos', 'Gestão', '', 150),
    ('classes.manage', 'Gerenciar turmas', 'Gestão', '', 160),
    ('reports.view', 'Ver relatórios', 'Relatórios', '', 170),
    ('permissions.manage', 'Gerenciar permissões', 'Administração', '', 180),
    ('users.manage', 'Gerenciar todos os usuários', 'Administração', '', 190),
    ('audit.view', 'Consultar auditoria', 'Administração', '', 200),
    ('store.manage', 'Analisar solicitações da loja', 'Loja', '', 210),
    ('reenrollment.manage', 'Gerenciar rematrículas', 'Administração', 'Contratos, follow-ups, rescisões e lembretes de renovação.', 220),
    ('reenrollment.financial', 'Concluir tarefas financeiras', 'Rematrícula', 'Permite concluir somente tarefas de carnê, boleto e taxa de matrícula.', 221);

INSERT INTO role_permissions (role_code, permission_code) VALUES
    ('student', 'dashboard.view_own'),
    ('student', 'journey.view_own'),
    ('student', 'mission.submit'),
    ('student', 'files.view_own'),
    ('student', 'lab.manage_own'),
    ('student', 'profile.edit_own'),
    ('teacher', 'dashboard.view_own'),
    ('teacher', 'profile.edit_own'),
    ('teacher', 'classes.view_assigned'),
    ('teacher', 'students.view_assigned'),
    ('teacher', 'submissions.review'),
    ('teacher', 'feedback.create'),
    ('supervisor', 'dashboard.view_own'),
    ('supervisor', 'profile.edit_own'),
    ('supervisor', 'classes.view_assigned'),
    ('supervisor', 'students.view_assigned'),
    ('supervisor', 'submissions.review'),
    ('supervisor', 'feedback.create'),
    ('supervisor', 'curriculum.manage'),
    ('supervisor', 'missions.manage'),
    ('supervisor', 'activities.manage'),
    ('supervisor', 'teachers.manage'),
    ('supervisor', 'students.manage'),
    ('supervisor', 'classes.manage'),
    ('supervisor', 'reports.view'),
    ('supervisor', 'store.manage'),
    ('supervisor', 'reenrollment.manage'),
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
    ('administrative', 'audit.view');

INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', code FROM permissions;

INSERT INTO curriculum_levels (code, name, sort_order, default_color) VALUES
    ('start', 'Start', 1, '#22C55E'),
    ('player', 'Player', 2, '#3B82F6'),
    ('adventure', 'Adventure', 3, '#F59E0B'),
    ('geek', 'Geek', 4, '#8B5CF6'),
    ('maker', 'Maker', 5, '#EF4444'),
    ('advanced', 'Advanced', 6, '#F26522'),
    ('startup', 'Startup', 7, '#1E72B8');

INSERT INTO store_products (name, description, category, price_joys, image_path, inventory_mode, stock_quantity, status, sort_order) VALUES
    ('Bala', 'Uma bala sortida por solicitação, conforme a disponibilidade da unidade.', 'Guloseimas', 1, '/images/store/bala.png', 'unlimited', NULL, 'active', 1),
    ('Caixa de bombons', 'Uma caixa de bombons para trocar pelos Joys conquistados nas missões.', 'Guloseimas', 300, '/images/store/caixa-bombons.png', 'unlimited', NULL, 'active', 2),
    ('Impressão 3D personalizada', 'Solicite a produção de uma peça ou chaveiro personalizado em impressão 3D.', 'Impressão 3D', 300, '/images/store/impressao-3d.png', 'unlimited', NULL, 'active', 3),
    ('Mouse gamer', 'Mouse gamer disponível conforme o modelo e o estoque da unidade.', 'Periféricos', 1500, '/images/store/mouse-gamer.png', 'unlimited', NULL, 'active', 4),
    ('Headset gamer', 'Headset gamer disponível conforme o modelo e o estoque da unidade.', 'Periféricos', 2500, '/images/store/headset-gamer.png', 'unlimited', NULL, 'active', 5),
    ('Kit mouse e teclado gamer', 'Kit com mouse e teclado gamer, sujeito à disponibilidade da unidade.', 'Periféricos', 3000, '/images/store/kit-mouse-teclado.png', 'unlimited', NULL, 'active', 6),
    ('Teclado gamer', 'Teclado gamer avulso para trocar pelos Joys conquistados nas missões.', 'Periféricos', 1500, '/images/store/teclado-gamer.svg', 'unlimited', NULL, 'active', 7);

INSERT INTO investment_products
    (name, description, risk_label, symbol, asset_type, daily_drift_basis_points,
     daily_volatility_basis_points, market_seed, market_anchor_date, market_anchor_price,
     monthly_rate_basis_points, minimum_joys, status, sort_order)
VALUES
    ('Cofrinho Seguro', 'Ativo simulado com pequenas oscilações para começar e aprender a acompanhar uma cotação.', 'Muito baixo', 'CJSF', 'fixed_income', 3, 35, 1103, CURRENT_DATE, 100, 10, 10, 'active', 1),
    ('Fundo Criativo', 'Fundo simulado diversificado, com variações moderadas ao longo dos dias e das semanas.', 'Baixo', 'CJFD', 'fund', 5, 100, 2207, CURRENT_DATE, 100, 20, 25, 'active', 2),
    ('Projeto Maker', 'Carteira simulada de empresas de inovação e fabricação digital, com oscilações mais visíveis.', 'Moderado', 'MKRS', 'stocks', 7, 180, 3301, CURRENT_DATE, 100, 30, 50, 'active', 3),
    ('Ações de Tecnologia', 'Índice educativo de ações de tecnologia. Pode subir ou cair diariamente e não representa empresas reais.', 'Moderado/alto', 'TECH', 'stocks', 10, 280, 4409, CURRENT_DATE, 100, 0, 30, 'active', 4),
    ('Energia Verde', 'Fundo educativo ligado a projetos sustentáveis, com valorização e desvalorização simuladas.', 'Moderado', 'ECO', 'etf', 7, 200, 5519, CURRENT_DATE, 100, 0, 30, 'active', 5),
    ('Bitcoin Simulado', 'Criptoativo exclusivamente educativo, com oscilações fortes. Não acompanha o preço do Bitcoin real.', 'Alto', 'BTC-SIM', 'crypto', 12, 650, 6629, CURRENT_DATE, 100, 0, 20, 'active', 6);

-- Única conta criada na instalação limpa.
-- E-mail: admin@createjoy.com | Senha temporária: Admin@123
INSERT INTO users
    (name, email, password_hash, role, status, must_change_password)
VALUES
    ('Admin Geral', 'admin@createjoy.com',
     '$2y$10$hklKvd5wLMUk8aNzme.gX.vSHxYq5UEhSVKGHZnpAYHP.9QsTJTMW',
     'admin', 'active', 1);

INSERT INTO schema_migrations (version, description)
VALUES ('2026.09.06-store-investments', 'Esquema completo com estoque, teclado avulso e carteira educativa de investimentos');

INSERT INTO schema_migrations (version, description)
VALUES ('2026.09.07-dashboard-analytics', 'Campo de gênero dos alunos e indicadores de alunos e solicitações da CreateStore');

INSERT INTO schema_migrations (version, description)
VALUES ('2026.09.08-investment-market', 'Mercado educativo com cotas, oscilações diárias e novos ativos simulados');
