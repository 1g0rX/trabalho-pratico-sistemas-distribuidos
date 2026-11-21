<?php
declare(strict_types=1);

$config = require dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/Database.php';
require_once dirname(__DIR__) . '/api/helpers.php';
require_once dirname(__DIR__) . '/api/DataService.php';

function verifyLearningFlow(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$pdo = Database::connection($config);
$pdo->beginTransaction();

try {
    $adminId = (int) $pdo->query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")->fetchColumn();
    verifyLearningFlow($adminId > 0, 'A instalação precisa ter um Admin Geral para executar o teste.');

    $token = bin2hex(random_bytes(4));
    $pdo->prepare("INSERT INTO modules (name, level, description, workload_hours, status, color) VALUES (?, ?, ?, 20, 'active', '#64748B')")
        ->execute(["Módulo anterior {$token}", random_int(20000, 25000), 'Módulo anterior usado somente durante a verificação.']);
    $previousModuleId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO modules (name, level, description, workload_hours, status, color) VALUES (?, ?, ?, 40, 'active', '#1E72B8')")
        ->execute(["Módulo atual {$token}", random_int(26000, 31000), 'Módulo atual usado somente durante a verificação.']);
    $currentModuleId = (int) $pdo->lastInsertId();

    $pdo->prepare("INSERT INTO classes (name, code, teacher_user_id, schedule, status) VALUES (?, ?, ?, 'Teste local', 'active')")
        ->execute(["Turma de verificação {$token}", "VERIFY-{$token}", $adminId]);
    $classId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO class_modules (class_id, module_id, sort_order) VALUES (?, ?, 1), (?, ?, 2)')
        ->execute([$classId, $previousModuleId, $classId, $currentModuleId]);

    $pdo->prepare("INSERT INTO users (name, email, password_hash, role, status, must_change_password) VALUES (?, ?, ?, 'student', 'active', 0)")
        ->execute(["Aluno Verificação {$token}", "verify-{$token}@example.invalid", password_hash('VerificationOnly!2026', PASSWORD_DEFAULT)]);
    $studentId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO students (user_id, class_id, current_module_id, computer_number, status, joy_balance) VALUES (?, ?, ?, '99', 'ativo', 777)")
        ->execute([$studentId, $classId, $currentModuleId]);

    $insertMission = $pdo->prepare("INSERT INTO missions (module_id, title, objective, description, lesson_number, sort_order, type, status, delivery_type, joys_reward, created_by) VALUES (?, ?, 'Objetivo de teste', 'Descrição de teste', 1, ?, ?, 'active', 'texto', 10, ?)");
    $insertMission->execute([$previousModuleId, "Missão anterior {$token}", 1, 'required', $adminId]);
    $previousMissionId = (int) $pdo->lastInsertId();
    $insertMission->execute([$currentModuleId, "Missão extra {$token}", 1, 'extra', $adminId]);
    $extraMissionId = (int) $pdo->lastInsertId();
    $insertMission->execute([$currentModuleId, "Missão obrigatória {$token}", 2, 'required', $adminId]);
    $requiredMissionId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO mission_prerequisites (mission_id, prerequisite_mission_id) VALUES (?, ?)')
        ->execute([$extraMissionId, $requiredMissionId]);

    $insertActivity = $pdo->prepare("INSERT INTO activities (mission_id, name, description, type, delivery_type, criteria, sort_order, status) VALUES (?, ?, 'Descrição de teste', ?, 'nenhuma', 'Marcar como concluída', ?, 'active')");
    $insertActivity->execute([$requiredMissionId, "Desafio extra {$token}", 'desafio', 1]);
    $extraActivityId = (int) $pdo->lastInsertId();
    $insertActivity->execute([$requiredMissionId, "Checklist obrigatório {$token}", 'exercicio', 2]);
    $requiredActivityId = (int) $pdo->lastInsertId();
    $insertActivity->execute([$requiredMissionId, "Material de apoio {$token}", 'arquivo', 1]);
    $fileActivityId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO activity_prerequisites (activity_id, prerequisite_activity_id) VALUES (?, ?)')
        ->execute([$extraActivityId, $requiredActivityId]);

    $viewer = ['id' => $studentId, 'role' => 'student', 'name' => "Aluno Verificação {$token}"];
    $service = new DataService($pdo);
    $initial = $service->bootstrap($viewer);
    verifyLearningFlow(count($initial['missions']) === 1, 'A missão extra foi mostrada antes da obrigatória ser concluída.');
    verifyLearningFlow((int) $initial['missions'][0]['id'] === $requiredMissionId, 'O aluno recebeu missão de outro módulo ou em ordem incorreta.');
    verifyLearningFlow(count($initial['activities']) === 2, 'O desafio extra foi mostrado antes do checklist obrigatório.');
    verifyLearningFlow((int) $initial['activities'][0]['id'] === $requiredActivityId, 'A atividade obrigatória não apareceu primeiro.');
    verifyLearningFlow((int) $initial['currentStudent']['joys'] === 777, 'O saldo inicial de Joys não foi carregado.');
    verifyLearningFlow($initial['currentStudent']['modulosConcluidosIds'] === [], 'Módulo anterior foi inferido como concluído sem registro.');

    $pdo->prepare("INSERT INTO student_activity_progress (student_id, activity_id, status, completed_at) VALUES (?, ?, 'completed', NOW())")
        ->execute([$studentId, $requiredActivityId]);
    $pdo->prepare("INSERT INTO student_missions (student_id, mission_id, status, started_at, completed_at) VALUES (?, ?, 'approved', NOW(), NOW())")
        ->execute([$studentId, $requiredMissionId]);
    $pdo->prepare("INSERT INTO student_module_completions (student_id, module_id, completion_type, completed_at, recorded_by) VALUES (?, ?, 'recognized', NOW(), ?)")
        ->execute([$studentId, $previousModuleId, $adminId]);
    recordModuleCompletionIfComplete($pdo, $studentId, $requiredMissionId, $adminId);

    $unlocked = $service->bootstrap($viewer);
    verifyLearningFlow(count($unlocked['missions']) === 2, 'A missão extra não foi liberada após a obrigatória.');
    verifyLearningFlow((int) $unlocked['missions'][0]['id'] === $requiredMissionId && (int) $unlocked['missions'][1]['id'] === $extraMissionId, 'Missões obrigatórias não estão aparecendo antes das extras.');
    verifyLearningFlow(count($unlocked['activities']) === 3, 'O desafio extra não foi liberado após o checklist obrigatório.');
    verifyLearningFlow((int) $unlocked['activities'][0]['id'] === $requiredActivityId && (int) $unlocked['activities'][2]['id'] === $extraActivityId, 'Checklist obrigatório, apoio e extra estão em ordem incorreta.');
    verifyLearningFlow((int) $unlocked['currentStudent']['progresso'] === 100, 'A missão extra alterou indevidamente o progresso obrigatório.');
    verifyLearningFlow(in_array($previousModuleId, $unlocked['currentStudent']['modulosConcluidosIds'], true), 'Conclusão anterior registrada não apareceu para o aluno.');
    verifyLearningFlow(in_array($currentModuleId, $unlocked['currentStudent']['modulosConcluidosIds'], true), 'Conclusão automática do módulo atual não foi registrada.');
    verifyLearningFlow(!in_array($previousMissionId, array_column($unlocked['missions'], 'id'), true), 'Missão de módulo anterior apareceu para o aluno.');
    verifyLearningFlow($fileActivityId > 0, 'Falha ao criar a atividade informativa de teste.');

    echo json_encode([
        'ok' => true,
        'checks' => [
            'current_module_only', 'required_before_extra', 'mission_unlock',
            'activity_checklist_unlock', 'starting_joys', 'real_module_completion',
            'extras_do_not_change_required_progress',
        ],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} finally {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
}
