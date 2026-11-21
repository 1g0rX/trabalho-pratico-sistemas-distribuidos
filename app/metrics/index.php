<?php
declare(strict_types=1);

header('Content-Type: text/plain; version=0.0.4; charset=utf-8');

$started = microtime(true);
$databaseUp = 0;
$studentCount = 0;
$pendingSubmissions = 0;
$pendingPurchases = 0;

try {
    $config = require dirname(__DIR__) . '/api/config.php';
    require_once dirname(__DIR__) . '/api/Database.php';
    $pdo = Database::connection($config);
    $pdo->query('SELECT 1');
    $databaseUp = 1;
    $studentCount = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'active'")->fetchColumn();
    $pendingSubmissions = (int) $pdo->query("SELECT COUNT(*) FROM submissions WHERE status = 'pending'")->fetchColumn();
    $pendingPurchases = (int) $pdo->query("SELECT COUNT(*) FROM store_purchase_requests WHERE status = 'pending'")->fetchColumn();
} catch (Throwable $exception) {
    error_log('[CreateJoy][metrics] ' . $exception->getMessage());
}

echo "# HELP createjoy_up Indica se a aplicação acessa o banco local.\n";
echo "# TYPE createjoy_up gauge\n";
echo "createjoy_up {$databaseUp}\n";
echo "# HELP createjoy_students_total Total de alunos fictícios ativos.\n";
echo "# TYPE createjoy_students_total gauge\n";
echo "createjoy_students_total {$studentCount}\n";
echo "# HELP createjoy_pending_submissions Entregas aguardando correção.\n";
echo "# TYPE createjoy_pending_submissions gauge\n";
echo "createjoy_pending_submissions {$pendingSubmissions}\n";
echo "# HELP createjoy_pending_store_requests Solicitações pendentes da loja.\n";
echo "# TYPE createjoy_pending_store_requests gauge\n";
echo "createjoy_pending_store_requests {$pendingPurchases}\n";
echo "# HELP createjoy_metrics_generation_seconds Tempo para gerar estas métricas.\n";
echo "# TYPE createjoy_metrics_generation_seconds gauge\n";
echo 'createjoy_metrics_generation_seconds ' . number_format(microtime(true) - $started, 6, '.', '') . "\n";
