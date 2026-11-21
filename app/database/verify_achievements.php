<?php
declare(strict_types=1);

$config = require dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/Database.php';
require_once dirname(__DIR__) . '/api/helpers.php';
require_once dirname(__DIR__) . '/api/AchievementService.php';

$pdo = Database::connection($config);
$tables = ['users', 'students', 'classes', 'modules', 'missions', 'submissions', 'medals', 'student_medals'];
$before = [];
foreach ($tables as $table) {
    $before[$table] = (int) $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
}

$checks = [];
$pdo->beginTransaction();
try {
    $service = new AchievementService($pdo);
    $level = (int) $pdo->query('SELECT COALESCE(MAX(level), 0) + 100 FROM modules')->fetchColumn();
    $pdo->prepare("INSERT INTO modules (name, level, description, status, color) VALUES ('__Teste Conquistas__', ?, 'Registro temporário', 'active', '#1E72B8')")
        ->execute([$level]);
    $moduleId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO missions (module_id, title, objective, description, type, status, sort_order) VALUES (?, '__Missão Teste__', '', 'Registro temporário', 'required', 'active', 1)")
        ->execute([$moduleId]);
    $missionId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES ('__Aluno Teste__', '__achievement_test__@createjoy.invalid', ?, 'student', 'active')")
        ->execute([password_hash('Temporary-Test-Only', PASSWORD_DEFAULT)]);
    $studentId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO students (user_id, current_module_id, status, enrolled_at) VALUES (?, ?, 'ativo', DATE_SUB(CURDATE(), INTERVAL 370 DAY))")
        ->execute([$studentId, $moduleId]);
    $pdo->prepare("INSERT INTO student_missions (student_id, mission_id, status, approved_at) VALUES (?, ?, 'approved', NOW())")
        ->execute([$studentId, $missionId]);

    $sync = $service->syncCatalog();
    $checks['catalog_has_document_items'] = $sync['available'] >= 185;
    $dynamic = $pdo->prepare("SELECT id FROM medals WHERE criteria_type = 'module_complete' AND criteria_value = ?");
    $dynamic->execute([$moduleId]);
    $courseMedalId = (int) $dynamic->fetchColumn();
    $checks['course_medal_created'] = $courseMedalId > 0;

    $newAwards = $service->evaluateStudent($studentId);
    $automaticAward = $pdo->prepare('SELECT COUNT(*) FROM student_medals WHERE student_id = ? AND medal_id = ?');
    $automaticAward->execute([$studentId, $courseMedalId]);
    $checks['course_medal_awarded_automatically'] = (int) $automaticAward->fetchColumn() === 1 && $newAwards !== [];

    $medalId = (int) $pdo->query("SELECT id FROM medals WHERE criteria_type LIKE 'manual_teacher_%' ORDER BY id LIMIT 1")->fetchColumn();
    $actorId = (int) $pdo->query("SELECT id FROM users WHERE role IN ('admin', 'supervisor', 'teacher') ORDER BY id LIMIT 1")->fetchColumn();
    $granted = $medalId > 0 && $actorId > 0 && $service->grant($studentId, $medalId, $actorId, 'Teste transacional; será desfeito.');
    $checks['manual_grant'] = $granted;
    $pdo->rollBack();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $exception;
}

$after = [];
foreach ($tables as $table) {
    $after[$table] = (int) $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
}
$checks['transaction_rolled_back'] = $before === $after;

$failed = array_keys(array_filter($checks, static fn(bool $ok): bool => !$ok));
echo json_encode([
    'ok' => $failed === [],
    'checks' => $checks,
    'failed' => $failed,
    'counts_unchanged' => $before,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
exit($failed === [] ? 0 : 1);
