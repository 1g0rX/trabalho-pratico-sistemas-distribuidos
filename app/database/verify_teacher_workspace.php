<?php
declare(strict_types=1);

$_SERVER['HTTP_HOST'] = 'localhost';
$config = require dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/Database.php';
require_once dirname(__DIR__) . '/api/helpers.php';
require_once dirname(__DIR__) . '/api/DataService.php';

function verifyTeacherWorkspace(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$pdo = Database::connection($config);
$token = bin2hex(random_bytes(4));
$pdo->beginTransaction();

try {
    $password = password_hash('VerificationOnly!2026', PASSWORD_DEFAULT);
    $userInsert = $pdo->prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')");
    $userInsert->execute(["Professor Verificação {$token}", "teacher-{$token}@example.invalid", $password, 'teacher']);
    $teacherId = (int) $pdo->lastInsertId();

    $level = (int) $pdo->query('SELECT COALESCE(MAX(level), 0) + 10 FROM modules')->fetchColumn();
    $moduleInsert = $pdo->prepare("INSERT INTO modules (name, level, description, status, color) VALUES (?, ?, 'Teste transacional', 'active', '#1E72B8')");
    $moduleInsert->execute(["Módulo Professor {$token}", $level]);
    $moduleId = (int) $pdo->lastInsertId();

    $classInsert = $pdo->prepare("INSERT INTO classes (name, teacher_user_id, schedule, status) VALUES (?, ?, 'Teste', 'active')");
    $classInsert->execute(["Turma Professor {$token}", $teacherId]);
    $classId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO class_modules (class_id, module_id, sort_order) VALUES (?, ?, 1)')->execute([$classId, $moduleId]);

    $userInsert->execute(["Aluno Verificação {$token}", "student-{$token}@example.invalid", $password, 'student']);
    $studentId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO students (user_id, class_id, current_module_id, status, joy_balance) VALUES (?, ?, ?, 'ativo', 100)")
        ->execute([$studentId, $classId, $moduleId]);

    $missionInsert = $pdo->prepare("
        INSERT INTO missions
            (module_id, title, objective, description, lesson_number, sort_order, type, status, delivery_type, created_by)
        VALUES (?, ?, 'Objetivo', 'Descrição', 1, ?, ?, 'active', 'texto', ?)
    ");
    $missionInsert->execute([$moduleId, "Obrigatória {$token}", 1, 'required', $teacherId]);
    $requiredMissionId = (int) $pdo->lastInsertId();
    $missionInsert->execute([$moduleId, "Extra {$token}", 2, 'extra', $teacherId]);
    $extraMissionId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO mission_prerequisites (mission_id, prerequisite_mission_id) VALUES (?, ?)')
        ->execute([$extraMissionId, $requiredMissionId]);

    $service = new DataService($pdo);
    $teacher = ['id' => $teacherId, 'role' => 'teacher'];
    $initial = $service->bootstrap($teacher);
    verifyTeacherWorkspace(count($initial['classes']) === 1, 'A turma vinculada não foi carregada.');
    verifyTeacherWorkspace(count($initial['students']) === 1, 'O aluno vinculado não foi carregado.');
    verifyTeacherWorkspace(count($initial['missions']) === 2, 'As missões do módulo vinculado não foram carregadas.');
    verifyTeacherWorkspace(count($initial['teacherMissionProgress']) === 2, 'O acompanhamento das missões não foi carregado.');

    $statuses = array_column($initial['teacherMissionProgress'], 'status', 'missionId');
    verifyTeacherWorkspace(($statuses[$requiredMissionId] ?? null) === 'available', 'A missão obrigatória deveria estar disponível.');
    verifyTeacherWorkspace(($statuses[$extraMissionId] ?? null) === 'blocked', 'A missão extra deveria estar bloqueada.');

    $pdo->prepare("INSERT INTO submissions (student_id, mission_id, attempt_number, learned, status, reviewed_by, reviewed_at) VALUES (?, ?, 1, 'Teste de progresso aprovado', 'approved', ?, NOW())")
        ->execute([$studentId, $requiredMissionId, $teacherId]);
    $recognizedApproval = $service->bootstrap($teacher);
    $recognizedStatuses = array_column($recognizedApproval['teacherMissionProgress'], 'status', 'missionId');
    verifyTeacherWorkspace(($recognizedStatuses[$requiredMissionId] ?? null) === 'approved', 'A entrega aprovada não apareceu como missão concluída.');
    verifyTeacherWorkspace(($recognizedStatuses[$extraMissionId] ?? null) === 'available', 'A aprovação real não liberou a missão extra.');
    verifyTeacherWorkspace((int) $recognizedApproval['students'][0]['progresso'] === 100, 'O progresso do aluno não reconheceu a entrega aprovada.');
    verifyTeacherWorkspace((int) $recognizedApproval['classes'][0]['progresso'] === 100, 'O progresso da turma não reconheceu a entrega aprovada.');

    $pdo->prepare('UPDATE students SET joy_balance = 125 WHERE user_id = ?')->execute([$studentId]);
    $pdo->prepare("
        INSERT INTO joy_transactions
            (student_id, amount, balance_after, transaction_type, reason, created_by)
        VALUES (?, 25, 125, 'teacher_credit', 'Teste transacional', ?)
    ")->execute([$studentId, $teacherId]);
    $withJoys = $service->bootstrap($teacher);
    verifyTeacherWorkspace((int) $withJoys['students'][0]['joys'] === 125, 'O novo saldo não foi carregado.');
    verifyTeacherWorkspace(count($withJoys['teacherJoyTransactions']) === 1, 'O histórico de Joys não foi carregado.');

    $pdo->prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?')
        ->execute(["Professor Atualizado {$token}", '(00) 00000-0000', $teacherId]);
    $withProfile = $service->bootstrap($teacher);
    verifyTeacherWorkspace($withProfile['currentTeacher']['name'] === "Professor Atualizado {$token}", 'O perfil atualizado não foi carregado.');
    verifyTeacherWorkspace($withProfile['currentTeacher']['telefone'] === '(00) 00000-0000', 'O telefone atualizado não foi carregado.');

    $pdo->rollBack();
    echo json_encode([
        'ok' => true,
        'checks' => [
            'assigned_students_only',
            'assigned_course_missions',
            'mission_status_tracking',
            'extra_mission_blocking',
            'approved_submission_progress_recovery',
            'class_progress_from_real_approval',
            'teacher_joy_history',
            'teacher_profile_fields',
            'transaction_rolled_back',
        ],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}
