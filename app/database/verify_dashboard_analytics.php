<?php
declare(strict_types=1);

$config = require dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/Database.php';
require_once dirname(__DIR__) . '/api/helpers.php';
require_once dirname(__DIR__) . '/api/DataService.php';

function verifyDashboardAnalytics(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$pdo = Database::connection($config);
$pdo->beginTransaction();

try {
    $adminId = (int) $pdo->query("SELECT id FROM users WHERE role = 'admin' AND status = 'active' ORDER BY id LIMIT 1")->fetchColumn();
    verifyDashboardAnalytics($adminId > 0, 'É necessário ter um Admin Geral ativo para executar o teste.');

    $token = bin2hex(random_bytes(5));
    $password = password_hash('VerificationOnly!2026', PASSWORD_DEFAULT);
    $studentStatement = $pdo->prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'student', 'active')");
    $studentProfile = $pdo->prepare("INSERT INTO students (user_id, status, joy_balance, gender) VALUES (?, 'ativo', 1000, ?)");
    $studentIds = [];

    foreach ([['Aluno Masculino', 'male'], ['Aluna Feminina', 'female'], ['Aluno Sem Informação', null]] as $position => $student) {
        $studentStatement->execute(["{$student[0]} {$token}", "dashboard-{$position}-{$token}@example.invalid", $password]);
        $studentId = (int) $pdo->lastInsertId();
        $studentProfile->execute([$studentId, $student[1]]);
        $studentIds[] = $studentId;
    }

    $productStatement = $pdo->prepare("INSERT INTO store_products (name, description, category, price_joys, image_path, status, sort_order) VALUES (?, 'Produto temporário', 'Teste', 10, '', 'active', 999)");
    $productStatement->execute(["Produto campeão {$token}"]);
    $championId = (int) $pdo->lastInsertId();
    $productStatement->execute(["Produto vice {$token}"]);
    $runnerUpId = (int) $pdo->lastInsertId();

    $requestStatement = $pdo->prepare("INSERT INTO store_purchase_requests (student_id, product_id, product_name, total_joys, request_details, status, reviewed_by, reviewed_at) VALUES (?, ?, ?, 10, 'Teste automatizado', ?, ?, ?)");
    $requestRows = [
        [$studentIds[0], $championId, "Produto campeão {$token}", 'approved', $adminId, date('Y-m-d H:i:s')],
        [$studentIds[1], $championId, "Produto campeão {$token}", 'approved', $adminId, date('Y-m-d H:i:s')],
        [$studentIds[2], $runnerUpId, "Produto vice {$token}", 'approved', $adminId, date('Y-m-d H:i:s')],
        [$studentIds[0], $championId, "Produto campeão {$token}", 'pending', null, null],
        [$studentIds[1], $runnerUpId, "Produto vice {$token}", 'rejected', $adminId, date('Y-m-d H:i:s')],
    ];
    foreach ($requestRows as $row) {
        $requestStatement->execute($row);
    }

    $data = (new DataService($pdo))->bootstrap([
        'id' => $adminId,
        'name' => 'Admin Geral',
        'email' => 'admin@example.invalid',
        'role' => 'admin',
        'initials' => 'AG',
    ]);
    $analytics = $data['managementAnalytics'] ?? [];
    $champion = $analytics['topProducts'][0] ?? null;

    $checks = [
        'gender_total' => ($analytics['gender']['total'] ?? -1) === 3,
        'gender_male' => ($analytics['gender']['male'] ?? -1) === 1,
        'gender_female' => ($analytics['gender']['female'] ?? -1) === 1,
        'gender_not_informed' => ($analytics['gender']['notInformed'] ?? -1) === 1,
        'requests_total' => ($analytics['store']['total'] ?? -1) === 5,
        'requests_approved' => ($analytics['store']['approved'] ?? -1) === 3,
        'requests_pending' => ($analytics['store']['pending'] ?? -1) === 1,
        'requests_rejected' => ($analytics['store']['rejected'] ?? -1) === 1,
        'top_product' => $champion
            && $champion['name'] === "Produto campeão {$token}"
            && $champion['approvedQuantity'] === 2,
    ];

    $failed = array_keys(array_filter($checks, static fn(bool $passed): bool => !$passed));
    verifyDashboardAnalytics(!$failed, 'Falharam as verificações: ' . implode(', ', $failed));

    echo json_encode([
        'ok' => true,
        'checks' => $checks,
        'transactionRolledBack' => true,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
} finally {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
}
