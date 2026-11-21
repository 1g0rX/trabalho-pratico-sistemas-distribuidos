<?php
declare(strict_types=1);

$config = require dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/Database.php';
require_once dirname(__DIR__) . '/api/AchievementService.php';
require_once dirname(__DIR__) . '/api/helpers.php';
require_once dirname(__DIR__) . '/api/DataService.php';

function verifyStoreInvestment(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = Database::connection($config);
$pdo->beginTransaction();
try {
    $adminId = (int) $pdo->query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")->fetchColumn();
    verifyStoreInvestment($adminId > 0, 'É necessário ter um Admin Geral para executar o teste.');
    $token = bin2hex(random_bytes(5));
    $pdo->prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'student', 'active')")
        ->execute(["Aluno Investimento {$token}", "investimento-{$token}@example.invalid", password_hash('VerificationOnly!2026', PASSWORD_DEFAULT)]);
    $studentId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO students (user_id, status, joy_balance) VALUES (?, ?, ?)')->execute([$studentId, 'ativo', 1000]);

    $plan = $pdo->query("SELECT id FROM investment_products WHERE name = 'Cofrinho Seguro'")->fetch();
    verifyStoreInvestment((bool) $plan, 'O Cofrinho Seguro não foi encontrado.');
    $pdo->prepare("INSERT INTO student_investments (student_id, product_id, principal_joys, accrued_joys, units, last_accrual_at) VALUES (?, ?, 100, 0, 1, NOW())")
        ->execute([$studentId, (int) $plan['id']]);

    $bitcoinProduct = $pdo->query("SELECT id, name, symbol, asset_type, daily_drift_basis_points, daily_volatility_basis_points, market_seed, market_anchor_date, market_anchor_price FROM investment_products WHERE name = 'Bitcoin Simulado'")->fetch();
    verifyStoreInvestment((bool) $bitcoinProduct, 'O Bitcoin Simulado não foi encontrado.');
    $bitcoinMarket = investmentMarketSnapshot($bitcoinProduct);
    $bitcoinUnits = 100 / (float) $bitcoinMarket['currentPrice'];
    $pdo->prepare("INSERT INTO student_investments (student_id, product_id, principal_joys, accrued_joys, units, last_accrual_at) VALUES (?, ?, 100, 0, ?, NOW())")
        ->execute([$studentId, (int) $bitcoinProduct['id'], $bitcoinUnits]);
    $pdo->prepare("INSERT INTO investment_transactions (student_id, product_id, transaction_type, amount_joys, principal_after, earnings_after, joy_balance_after) VALUES (?, ?, 'deposit', 100, 100, 0, 900)")
        ->execute([$studentId, (int) $bitcoinProduct['id']]);

    $pdo->prepare("INSERT INTO store_products (name, description, category, price_joys, inventory_mode, stock_quantity, status, sort_order) VALUES (?, 'Somente teste', 'Exclusivo', 55, 'limited', 0, 'inactive', 999)")
        ->execute(["Produto limitado {$token}"]);

    $service = new DataService($pdo);
    $studentData = $service->bootstrap(['id' => $studentId, 'name' => 'Aluno Teste', 'email' => '', 'role' => 'student', 'initials' => 'AT']);
    $adminData = $service->bootstrap(['id' => $adminId, 'name' => 'Admin Geral', 'email' => '', 'role' => 'admin', 'initials' => 'AG']);
    $cofrinho = array_values(array_filter($studentData['investmentWallet']['products'], static fn(array $item): bool => $item['name'] === 'Cofrinho Seguro'))[0] ?? null;
    $bitcoin = array_values(array_filter($studentData['investmentWallet']['products'], static fn(array $item): bool => $item['name'] === 'Bitcoin Simulado'))[0] ?? null;
    $limited = array_values(array_filter($adminData['storeProducts'], static fn(array $item): bool => $item['name'] === "Produto limitado {$token}"))[0] ?? null;

    $checks = [
        'keyboard_is_unlimited' => count(array_filter($studentData['storeProducts'], static fn(array $item): bool => $item['name'] === 'Teclado gamer' && $item['priceJoys'] === 1500 && $item['inventoryMode'] === 'unlimited')) === 1,
        'six_educational_options' => count($studentData['investmentWallet']['products']) === 6,
        'legacy_value_preserved_as_units' => $cofrinho && $cofrinho['availableJoys'] === 100 && abs($cofrinho['marketValueJoys'] - 100) < 0.001,
        'thirty_day_market_history' => $bitcoin && count($bitcoin['history']) === 31,
        'bitcoin_simulation_available' => $bitcoin && $bitcoin['symbol'] === 'BTC-SIM' && $bitcoin['assetType'] === 'crypto',
        'market_variations_available' => $bitcoin && array_key_exists('changeDay', $bitcoin) && array_key_exists('changeWeek', $bitcoin) && array_key_exists('changeMonth', $bitcoin),
        'existing_position_daily_return_matches_chart' => $cofrinho
            && abs($cofrinho['todayProfitLossPercent'] - $cofrinho['changeDay']) < 0.011
            && abs($cofrinho['todayProfitLossJoys'] - (($cofrinho['history'][30]['price'] - $cofrinho['history'][29]['price']) * $cofrinho['units'])) < 0.011,
        'same_day_purchase_starts_at_zero' => $bitcoin
            && abs($bitcoin['todayOpeningValueJoys']) < 0.011
            && abs($bitcoin['todayProfitLossJoys']) < 0.011
            && abs($bitcoin['todayProfitLossPercent']) < 0.011,
        'inactive_hidden_from_student' => count(array_filter($studentData['storeProducts'], static fn(array $item): bool => $item['name'] === "Produto limitado {$token}")) === 0,
        'inactive_visible_to_management' => $limited && $limited['status'] === 'inactive' && $limited['soldOut'] === true,
        'management_teacher_data_available' => array_key_exists('teacherMissionProgress', $adminData) && array_key_exists('teacherJoyTransactions', $adminData),
    ];
    $failed = array_keys(array_filter($checks, static fn(bool $passed): bool => !$passed));
    verifyStoreInvestment(!$failed, 'Falharam as verificações: ' . implode(', ', $failed));
    echo json_encode(['ok' => true, 'checks' => $checks, 'transactionRolledBack' => true], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
}
