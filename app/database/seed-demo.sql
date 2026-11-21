-- Dados exclusivamente fictícios para a demonstração local.
-- A senha de todas as contas abaixo é Admin@123.

SET NAMES utf8mb4;
SET @demo_password = '$2y$10$hklKvd5wLMUk8aNzme.gX.vSHxYq5UEhSVKGHZnpAYHP.9QsTJTMW';

INSERT INTO users (name, email, password_hash, role, status, must_change_password) VALUES
    ('Aluno Demonstração', 'aluno.demo@createjoy.local', @demo_password, 'student', 'active', 0),
    ('Marina Exemplo', 'marina.exemplo@createjoy.local', @demo_password, 'student', 'active', 0),
    ('Professor Demonstração', 'professor.demo@createjoy.local', @demo_password, 'teacher', 'active', 0),
    ('Supervisão Demonstração', 'supervisao.demo@createjoy.local', @demo_password, 'supervisor', 'active', 0),
    ('Financeiro Demonstração', 'financeiro.demo@createjoy.local', @demo_password, 'finance', 'active', 0),
    ('Gestão Administrativa', 'administrativo.demo@createjoy.local', @demo_password, 'administrative', 'active', 0)
ON DUPLICATE KEY UPDATE
    name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role),
    status = 'active', must_change_password = 0;

INSERT INTO semesters (name, start_date, end_date, status)
VALUES ('Demonstração 2026', '2026-08-01', '2026-12-20', 'active')
ON DUPLICATE KEY UPDATE start_date = VALUES(start_date), end_date = VALUES(end_date), status = VALUES(status);

INSERT INTO modules (curriculum_level_id, name, level, description, workload_hours, status, color)
SELECT id, 'Player Básico — Demonstração', 20,
       'Introdução à lógica, eletrônica e criação de projetos tecnológicos.', 24, 'active', '#3B82F6'
FROM curriculum_levels WHERE code = 'player'
ON DUPLICATE KEY UPDATE description = VALUES(description), status = 'active';

INSERT INTO classes (semester_id, code, name, teacher_user_id, schedule, room, status)
SELECT semester.id, 'DEMO-2026', 'Turma Demonstração', teacher.id,
       'Quarta-feira, 14h', 'Laboratório 1', 'active'
FROM semesters semester
JOIN users teacher ON teacher.email = 'professor.demo@createjoy.local'
WHERE semester.name = 'Demonstração 2026'
ON DUPLICATE KEY UPDATE teacher_user_id = VALUES(teacher_user_id), schedule = VALUES(schedule), status = 'active';

INSERT INTO class_schedules (class_id, weekday, start_time, end_time, location)
SELECT id, 3, '14:00:00', '15:30:00', 'Laboratório 1'
FROM classes WHERE code = 'DEMO-2026'
ON DUPLICATE KEY UPDATE end_time = VALUES(end_time), location = VALUES(location);

INSERT INTO teacher_profiles (user_id, specialization, biography)
SELECT id, 'Robótica e programação', 'Perfil fictício usado somente na demonstração local.'
FROM users WHERE email = 'professor.demo@createjoy.local'
ON DUPLICATE KEY UPDATE specialization = VALUES(specialization), biography = VALUES(biography);

INSERT INTO class_modules (class_id, module_id, sort_order, status)
SELECT class.id, module.id, 1, 'active'
FROM classes class
JOIN modules module ON module.name = 'Player Básico — Demonstração'
WHERE class.code = 'DEMO-2026'
ON DUPLICATE KEY UPDATE status = 'active';

INSERT INTO students
    (user_id, class_id, current_module_id, current_semester_id, enrollment_number,
     gender, guardian_name, guardian_phone, computer_number, status, joy_balance, enrolled_at)
SELECT student.id, class.id, module.id, semester.id, 'DEMO-001',
       'male', 'Responsável Demonstração', '(31) 99999-0001', '01', 'ativo', 3200, '2026-08-01'
FROM users student
JOIN classes class ON class.code = 'DEMO-2026'
JOIN modules module ON module.name = 'Player Básico — Demonstração'
JOIN semesters semester ON semester.name = 'Demonstração 2026'
WHERE student.email = 'aluno.demo@createjoy.local'
ON DUPLICATE KEY UPDATE class_id = VALUES(class_id), current_module_id = VALUES(current_module_id),
    current_semester_id = VALUES(current_semester_id), joy_balance = VALUES(joy_balance), status = 'ativo';

INSERT INTO students
    (user_id, class_id, current_module_id, current_semester_id, enrollment_number,
     gender, guardian_name, guardian_phone, computer_number, status, joy_balance, enrolled_at)
SELECT student.id, class.id, module.id, semester.id, 'DEMO-002',
       'female', 'Responsável Exemplo', '(31) 99999-0002', '02', 'ativo', 950, '2026-08-01'
FROM users student
JOIN classes class ON class.code = 'DEMO-2026'
JOIN modules module ON module.name = 'Player Básico — Demonstração'
JOIN semesters semester ON semester.name = 'Demonstração 2026'
WHERE student.email = 'marina.exemplo@createjoy.local'
ON DUPLICATE KEY UPDATE class_id = VALUES(class_id), current_module_id = VALUES(current_module_id),
    current_semester_id = VALUES(current_semester_id), joy_balance = VALUES(joy_balance), status = 'ativo';

INSERT INTO class_enrollments (class_id, student_id, semester_id, status, enrolled_at, created_by)
SELECT class.id, student.id, semester.id, 'active', '2026-08-01', supervisor.id
FROM classes class
JOIN semesters semester ON semester.name = 'Demonstração 2026'
JOIN users student ON student.email = 'aluno.demo@createjoy.local'
JOIN users supervisor ON supervisor.email = 'supervisao.demo@createjoy.local'
WHERE class.code = 'DEMO-2026';

INSERT INTO class_enrollments (class_id, student_id, semester_id, status, enrolled_at, created_by)
SELECT class.id, student.id, semester.id, 'active', '2026-08-01', supervisor.id
FROM classes class
JOIN semesters semester ON semester.name = 'Demonstração 2026'
JOIN users student ON student.email = 'marina.exemplo@createjoy.local'
JOIN users supervisor ON supervisor.email = 'supervisao.demo@createjoy.local'
WHERE class.code = 'DEMO-2026';

INSERT INTO missions
    (module_id, title, objective, description, lesson_number, sort_order, type, status,
     delivery_type, steps_json, joys_reward, created_by)
SELECT module.id, 'Conhecendo o Arduino', 'Identificar os componentes essenciais da placa.',
       'Explore a placa Arduino e registre o que aprendeu durante a montagem.',
       1, 1, 'required', 'active', 'mixed',
       '["Observe as entradas e saídas da placa.","Monte o circuito indicado.","Teste e registre o resultado."]',
       120, supervisor.id
FROM modules module
JOIN users supervisor ON supervisor.email = 'supervisao.demo@createjoy.local'
WHERE module.name = 'Player Básico — Demonstração';

INSERT INTO missions
    (module_id, title, objective, description, lesson_number, sort_order, type, status,
     delivery_type, steps_json, joys_reward, created_by)
SELECT module.id, 'Semáforo Inteligente', 'Programar uma sequência de LEDs com temporização.',
       'Crie um semáforo com três LEDs e explique a lógica utilizada no código.',
       2, 2, 'required', 'active', 'mixed',
       '["Monte os três LEDs.","Programe a sequência.","Teste os tempos e envie sua conclusão."]',
       180, supervisor.id
FROM modules module
JOIN users supervisor ON supervisor.email = 'supervisao.demo@createjoy.local'
WHERE module.name = 'Player Básico — Demonstração';

INSERT INTO missions
    (module_id, title, objective, description, lesson_number, sort_order, type, status,
     delivery_type, steps_json, joys_reward, created_by)
SELECT module.id, 'Desafio Extra: Luz Automática', 'Usar um sensor de luminosidade.',
       'Missão opcional liberada após a missão Conhecendo o Arduino.',
       3, 3, 'extra', 'active', 'mixed',
       '["Conecte o sensor.","Defina um limite de luz.","Demonstre o funcionamento."]',
       90, supervisor.id
FROM modules module
JOIN users supervisor ON supervisor.email = 'supervisao.demo@createjoy.local'
WHERE module.name = 'Player Básico — Demonstração';

INSERT INTO mission_prerequisites (mission_id, prerequisite_mission_id)
SELECT extra.id, required_mission.id
FROM missions extra
JOIN missions required_mission ON required_mission.title = 'Conhecendo o Arduino'
WHERE extra.title = 'Desafio Extra: Luz Automática'
ON DUPLICATE KEY UPDATE prerequisite_mission_id = VALUES(prerequisite_mission_id);

INSERT INTO activities (mission_id, name, description, type, delivery_type, criteria, sort_order, status)
SELECT id, 'Conferir componentes', 'Separe a placa, o cabo USB e os LEDs.',
       'exercise', 'checklist', 'Todos os materiais devem estar disponíveis.', 1, 'active'
FROM missions WHERE title = 'Conhecendo o Arduino';

INSERT INTO activities (mission_id, name, description, type, delivery_type, criteria, sort_order, status)
SELECT id, 'Testar o circuito', 'Confirme se o LED acende antes de enviar a missão.',
       'exercise', 'checklist', 'O circuito deve funcionar sem aquecimento.', 2, 'active'
FROM missions WHERE title = 'Conhecendo o Arduino';

INSERT INTO student_missions (student_id, mission_id, status, available_at)
SELECT student.id, mission.id, 'available', NOW()
FROM users student
JOIN missions mission ON mission.title IN ('Conhecendo o Arduino', 'Semáforo Inteligente')
WHERE student.email IN ('aluno.demo@createjoy.local', 'marina.exemplo@createjoy.local')
ON DUPLICATE KEY UPDATE status = VALUES(status), available_at = VALUES(available_at);

INSERT INTO student_activity_progress (student_id, activity_id, status, completed_at)
SELECT student.id, activity.id, 'completed', NOW()
FROM users student
JOIN activities activity ON activity.name IN ('Conferir componentes', 'Testar o circuito')
WHERE student.email = 'aluno.demo@createjoy.local'
ON DUPLICATE KEY UPDATE status = 'completed', completed_at = VALUES(completed_at);

INSERT INTO submissions (student_id, mission_id, attempt_number, notes, learned, status, submitted_at)
SELECT student.id, mission.id, 1, 'Circuito montado para a demonstração.',
       'Aprendi a identificar os pinos digitais e a sequência do circuito.', 'pending', NOW()
FROM users student
JOIN missions mission ON mission.title = 'Conhecendo o Arduino'
WHERE student.email = 'marina.exemplo@createjoy.local'
ON DUPLICATE KEY UPDATE learned = VALUES(learned), status = 'pending';

INSERT INTO student_contracts
    (student_id, contract_signed_at, contract_start_date, contract_end_date, duration_months,
     payment_method, payment_cycle_end_date, enrollment_fee_required, enrollment_fee_next_date,
     billing_action, contract_status, renewal_status, notes, created_by, updated_by)
SELECT student.id, '2026-07-20', '2026-08-01', '2027-07-31', 12,
       'boleto', '2027-07-31', 1, '2027-07-01',
       'none', 'active', 'completed', 'Contrato fictício para demonstração.', supervisor.id, supervisor.id
FROM users student
JOIN users supervisor ON supervisor.email = 'supervisao.demo@createjoy.local'
WHERE student.email = 'aluno.demo@createjoy.local'
ON DUPLICATE KEY UPDATE contract_status = VALUES(contract_status), renewal_status = VALUES(renewal_status),
    notes = VALUES(notes);

INSERT INTO student_contracts
    (student_id, contract_start_date, contract_end_date, duration_months, payment_method,
     billing_action, contract_status, renewal_status, notes, created_by, updated_by)
SELECT student.id, '2026-08-01', '2026-12-20', 5, 'card',
       'renew_contract', 'pending', 'confirmed', 'Responsável confirmou; falta criar o novo contrato.', supervisor.id, supervisor.id
FROM users student
JOIN users supervisor ON supervisor.email = 'supervisao.demo@createjoy.local'
WHERE student.email = 'marina.exemplo@createjoy.local'
ON DUPLICATE KEY UPDATE contract_status = VALUES(contract_status), renewal_status = VALUES(renewal_status),
    billing_action = VALUES(billing_action), notes = VALUES(notes);

INSERT INTO contract_reminders
    (contract_id, student_id, reminder_type, title, due_at, notes, financial_responsible_name,
     billing_installments, billing_first_due_date, billing_due_day, sponte_registered, status, created_by)
SELECT contract.id, contract.student_id, 'issue_boleto', 'Emitir carnê de boletos',
       '2026-11-25 09:00:00', 'Tarefa fictícia para testar o fluxo do financeiro.',
       'Responsável Demonstração', 6, '2026-12-10', 10, 1, 'pending', supervisor.id
FROM student_contracts contract
JOIN users student ON student.id = contract.student_id
JOIN users supervisor ON supervisor.email = 'supervisao.demo@createjoy.local'
WHERE student.email = 'aluno.demo@createjoy.local';
