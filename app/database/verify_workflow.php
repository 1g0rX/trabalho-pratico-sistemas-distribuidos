<?php
declare(strict_types=1);

$config = require dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/Database.php';
require_once dirname(__DIR__) . '/api/AchievementService.php';
require_once dirname(__DIR__) . '/api/helpers.php';
require_once dirname(__DIR__) . '/api/DataService.php';

$pdo = Database::connection($config);
$pdo->beginTransaction();

try {
    $adminId = (int) $pdo->query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")->fetchColumn();
    $passwordHash = password_hash('Integration@123', PASSWORD_DEFAULT);

    $pdo->exec("
        INSERT INTO semesters (name, start_date, end_date, status)
        VALUES ('Semestre de validação', '2026-01-01', '2026-06-30', 'active')
    ");
    $semesterId = (int) $pdo->lastInsertId();
    $levelId = (int) $pdo->query("SELECT id FROM curriculum_levels WHERE code = 'start'")->fetchColumn();

    $module = $pdo->prepare("
        INSERT INTO modules
            (curriculum_level_id, name, level, description, workload_hours, status, color)
        VALUES (?, 'Módulo de validação', 1, 'Somente teste transacional', 20, 'active', '#22C55E')
    ");
    $module->execute([$levelId]);
    $moduleId = (int) $pdo->lastInsertId();

    $user = $pdo->prepare("
        INSERT INTO users (name, email, password_hash, role, status)
        VALUES (?, ?, ?, ?, 'active')
    ");
    $user->execute(['Professor Validação', 'professor.validacao@createjoy.local', $passwordHash, 'teacher']);
    $teacherId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO teacher_profiles (user_id, specialization) VALUES (?, ?)')->execute([$teacherId, 'Robótica']);

    $class = $pdo->prepare("
        INSERT INTO classes (semester_id, code, name, teacher_user_id, schedule, status)
        VALUES (?, 'TESTE-01', 'Turma de validação', ?, 'Segunda 10h', 'active')
    ");
    $class->execute([$semesterId, $teacherId]);
    $classId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO class_schedules (class_id, weekday, start_time, end_time) VALUES (?, 1, "10:00:00", "12:00:00")')->execute([$classId]);
    $pdo->prepare('INSERT INTO class_modules (class_id, module_id, sort_order) VALUES (?, ?, 1)')->execute([$classId, $moduleId]);

    $user->execute(['Aluno Validação', 'aluno.validacao@createjoy.local', $passwordHash, 'student']);
    $studentId = (int) $pdo->lastInsertId();
    $student = $pdo->prepare("
        INSERT INTO students
            (user_id, class_id, current_module_id, current_semester_id, computer_number, status)
        VALUES (?, ?, ?, ?, '01', 'ativo')
    ");
    $student->execute([$studentId, $classId, $moduleId, $semesterId]);
    $pdo->prepare("
        INSERT INTO class_enrollments
            (class_id, student_id, semester_id, status, enrolled_at, created_by)
        VALUES (?, ?, ?, 'active', CURDATE(), ?)
    ")->execute([$classId, $studentId, $semesterId, $adminId]);

    $mission = $pdo->prepare("
        INSERT INTO missions
            (module_id, title, objective, description, lesson_number, sort_order,
             type, status, delivery_type, joys_reward, created_by)
        VALUES (?, 'Missão de validação', 'Validar o fluxo', 'Registro temporário', 1, 1,
                'required', 'active', 'codigo', 10, ?)
    ");
    $mission->execute([$moduleId, $adminId]);
    $missionId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO mission_steps (mission_id, step_order, instruction) VALUES (?, 1, "Executar o teste")')->execute([$missionId]);
    $mission->execute([$moduleId, $adminId]);
    $dependentMissionId = (int) $pdo->lastInsertId();
    $pdo->prepare('UPDATE missions SET title = ?, sort_order = 2, lesson_number = 2 WHERE id = ?')
        ->execute(['Missão dependente de validação', $dependentMissionId]);
    $pdo->prepare('INSERT INTO mission_prerequisites (mission_id, prerequisite_mission_id) VALUES (?, ?)')
        ->execute([$dependentMissionId, $missionId]);
    $pdo->prepare("
        INSERT INTO activities
            (mission_id, name, description, type, delivery_type, criteria, sort_order, status)
        VALUES (?, 'Atividade de validação', '', 'exercise', 'codigo', 'Enviar código', 1, 'active')
    ")->execute([$missionId]);
    $pdo->prepare("
        INSERT INTO student_missions (student_id, mission_id, status, started_at, submitted_at)
        VALUES (?, ?, 'submitted', NOW(), NOW())
    ")->execute([$studentId, $missionId]);
    $pdo->prepare("
        INSERT INTO submissions
            (student_id, mission_id, attempt_number, notes, learned, status)
        VALUES (?, ?, 1, 'Anotação de teste', 'Aprendizado de teste', 'pending')
    ")->execute([$studentId, $missionId]);

    $pdo->exec("INSERT INTO lab_kits (code, name, description) VALUES ('KIT-TESTE', 'Kit de validação', '')");
    $kitId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO lab_kit_items (kit_id, name, quantity) VALUES (?, "Componente de teste", 2)')->execute([$kitId]);
    $pdo->prepare("
        INSERT INTO student_kit_assignments (student_id, kit_id, module_id, assigned_by)
        VALUES (?, ?, ?, ?)
    ")->execute([$studentId, $kitId, $moduleId, $teacherId]);
    $pdo->prepare("
        INSERT INTO student_materials (student_id, name, quantity)
        VALUES (?, 'Material de teste', 1)
    ")->execute([$studentId]);
    $pdo->prepare("
        INSERT INTO pedagogical_notes (student_id, author_user_id, class_id, note, visibility)
        VALUES (?, ?, ?, 'Observação de validação', 'staff')
    ")->execute([$studentId, $adminId, $classId]);
    $pdo->exec("
        INSERT INTO medals (name, description, criteria_type, criteria_value, joys_reward, status)
        VALUES ('Medalha de validação', 'Somente teste transacional', 'first_submission', 1, 5, 'active')
    ");
    updateStudentMedals($pdo, $studentId);
    writeAuditLog($pdo, $adminId, 'save', 'workflow_validation', $studentId);

    $pdo->prepare('UPDATE students SET joy_balance = 500 WHERE user_id = ?')->execute([$studentId]);
    $storeProduct = $pdo->query("SELECT id, name, price_joys FROM store_products WHERE name = 'Impressão 3D personalizada' AND status = 'active' LIMIT 1")->fetch();
    if (!$storeProduct || (int) $storeProduct['price_joys'] !== 300) {
        throw new RuntimeException('O item estrutural da CreateStore não foi encontrado com o valor esperado.');
    }
    $storeRequest = $pdo->prepare("
        INSERT INTO store_purchase_requests
            (student_id, product_id, product_name, total_joys, request_details, status)
        VALUES (?, ?, ?, ?, 'Peça de validação em azul', 'pending')
    ");
    $storeRequest->execute([$studentId, (int) $storeProduct['id'], $storeProduct['name'], (int) $storeProduct['price_joys']]);
    $storeRequestId = (int) $pdo->lastInsertId();
    $joyTransaction = $pdo->prepare("
        INSERT INTO joy_transactions
            (student_id, amount, balance_after, transaction_type, reason, created_by, reference_key)
        VALUES (?, -300, 200, 'store_purchase', 'Compra de validação', ?, ?)
    ");
    $joyTransaction->execute([$studentId, $adminId, 'store_request:' . $storeRequestId]);
    $joyTransactionId = (int) $pdo->lastInsertId();
    $pdo->prepare('UPDATE students SET joy_balance = 200 WHERE user_id = ?')->execute([$studentId]);
    $pdo->prepare("
        UPDATE store_purchase_requests
        SET status = 'approved', reviewed_by = ?, review_notes = 'Aprovado no teste',
            joy_transaction_id = ?, reviewed_at = NOW()
        WHERE id = ?
    ")->execute([$adminId, $joyTransactionId, $storeRequestId]);

    $service = new DataService($pdo);
    $adminData = $service->bootstrap([
        'id' => $adminId,
        'name' => 'Admin Geral',
        'email' => 'admin@createjoy.com',
        'role' => 'admin',
        'initials' => 'AG',
    ]);
    $studentData = $service->bootstrap([
        'id' => $studentId,
        'name' => 'Aluno Validação',
        'email' => 'aluno.validacao@createjoy.local',
        'role' => 'student',
        'initials' => 'AV',
    ]);

    $dependentMission = null;
    foreach ($studentData['missions'] as $loadedMission) {
        if ((int) $loadedMission['id'] === $dependentMissionId) {
            $dependentMission = $loadedMission;
            break;
        }
    }

    $checks = [
        'adminSeesStudent' => count($adminData['students']) >= 1,
        'adminSeesTeacher' => count($adminData['teachers']) >= 1,
        'moduleLoaded' => count($adminData['modules']) === 1,
        'classLoaded' => count($adminData['classes']) === 1,
        'missionLoaded' => count($studentData['missions']) === 2,
        'missionStepLoaded' => count($studentData['missions'][0]['passos'] ?? []) === 1,
        'prerequisiteBlocksMission' => ($dependentMission['bloqueada'] ?? false) === true,
        'submissionLoadedWithoutFile' => count($studentData['submissions']) === 1
            && count($studentData['submissions'][0]['arquivosDetalhes'] ?? []) === 0,
        'submittedMissionStateLoaded' => ($studentData['missions'][0]['entregue'] ?? false) === true
            && ($studentData['missions'][0]['situacao'] ?? '') === 'submitted',
        'kitLoaded' => count($studentData['labKits']) === 1,
        'materialLoaded' => count($studentData['personalMaterials']) === 1,
        'semesterLoadedForAdmin' => count(array_filter($adminData['semesters'], static fn(array $semester): bool => (int) $semester['id'] === $semesterId)) === 1,
        'labCatalogLoadedForAdmin' => count($adminData['labKits']) === 1,
        'kitAssignmentLoadedForAdmin' => count($adminData['kitAssignments']) === 1,
        'pedagogicalNoteLoaded' => count($adminData['pedagogicalNotes']) === 1,
        'automaticMedalAwarded' => count($studentData['medals']) === 1 && ($studentData['medals'][0]['conquistada'] ?? false) === true,
        'auditLogLoaded' => count($adminData['auditLogs']) >= 1,
        'storeCatalogLoaded' => count($studentData['storeProducts']) === 7
            && count(array_filter($studentData['storeProducts'], static fn(array $product): bool => $product['name'] === 'Bala' && $product['priceJoys'] === 1)) === 1
            && count(array_filter($studentData['storeProducts'], static fn(array $product): bool => $product['name'] === 'Impressão 3D personalizada' && $product['priceJoys'] === 300)) === 1,
        'storeRequestLoadedForStudent' => count($studentData['storeRequests']) === 1 && ($studentData['storeRequests'][0]['status'] ?? '') === 'approved',
        'storeRequestLoadedForAdmin' => count($adminData['storeRequests']) === 1,
        'storeDeductionRecorded' => ($studentData['currentStudent']['joys'] ?? -1) === 200
            && (int) $pdo->query("SELECT amount FROM joy_transactions WHERE reference_key = 'store_request:{$storeRequestId}'")->fetchColumn() === -300,
    ];

    $failedChecks = array_keys(array_filter($checks, static fn(bool $passed): bool => !$passed));
    if ($failedChecks) {
        throw new RuntimeException('Falharam as verificações: ' . implode(', ', $failedChecks));
    }

    echo json_encode([
        'ok' => true,
        'transactionRolledBack' => true,
        'checks' => $checks,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} finally {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
}
