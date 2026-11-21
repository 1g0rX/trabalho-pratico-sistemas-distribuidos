<?php
declare(strict_types=1);

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requestData(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($contentType, 'application/json')) {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            jsonResponse(['ok' => false, 'message' => 'JSON inválido.'], 400);
        }
        return $data;
    }

    return $_POST;
}

function requireMethod(string ...$methods): void
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $allowed = array_map('strtoupper', $methods);
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        jsonResponse(['ok' => false, 'message' => 'Método não permitido.'], 405);
    }
}

function csrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf_token'];
}

function requireCsrf(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($provided === '' || !hash_equals(csrfToken(), $provided)) {
        jsonResponse(['ok' => false, 'message' => 'Sessão expirada. Atualize a página e tente novamente.'], 419);
    }
}

function currentUser(): array
{
    if (empty($_SESSION['user']) || !is_array($_SESSION['user'])) {
        jsonResponse(['ok' => false, 'message' => 'Faça login para continuar.'], 401);
    }
    return $_SESSION['user'];
}

function requireRole(string ...$roles): array
{
    $user = currentUser();
    if (!in_array($user['role'], $roles, true)) {
        jsonResponse(['ok' => false, 'message' => 'Você não tem permissão para esta ação.'], 403);
    }
    return $user;
}

function requirePermission(PDO $pdo, string $permissionCode): array
{
    $user = currentUser();
    if ($user['role'] === 'admin') {
        return $user;
    }

    $statement = $pdo->prepare("
        SELECT COALESCE(
            (SELECT override_permission.allowed
             FROM user_permission_overrides override_permission
             WHERE override_permission.user_id = ?
               AND override_permission.permission_code = ?),
            EXISTS(
                SELECT 1
                FROM role_permissions role_permission
                WHERE role_permission.role_code = ?
                  AND role_permission.permission_code = ?
            )
        ) AS allowed
    ");
    $statement->execute([
        (int) $user['id'],
        $permissionCode,
        $user['role'],
        $permissionCode,
    ]);

    if (!(bool) $statement->fetchColumn()) {
        jsonResponse(['ok' => false, 'message' => 'Você não tem permissão para esta ação.'], 403);
    }
    return $user;
}

function initials(string $name): string
{
    $parts = preg_split('/\s+/u', trim($name)) ?: [];
    $letters = '';
    foreach (array_slice($parts, 0, 2) as $part) {
        $letters .= mb_substr($part, 0, 1, 'UTF-8');
    }
    return mb_strtoupper($letters ?: '?', 'UTF-8');
}

/**
 * As fotos são entregues pela API, sem expor a pasta física onde ficam salvas.
 * Isso também permite preservar os avatares ao atualizar os arquivos do site.
 */
function avatarUrl(mixed $storedPath, int $userId): ?string
{
    return trim((string) $storedPath) !== ''
        ? '/api/index.php?route=profile/avatar&id=' . $userId
        : null;
}

function resolveAvatarFilePath(string $storedPath): ?string
{
    $storedPath = str_replace('\\', '/', trim($storedPath));
    if ($storedPath === '' || str_contains($storedPath, '..')) {
        return null;
    }

    $projectRoot = dirname(__DIR__);
    if (str_starts_with($storedPath, 'avatars/')) {
        $baseDirectory = $projectRoot . DIRECTORY_SEPARATOR . 'storage';
        $relativePath = $storedPath;
    } elseif (str_starts_with($storedPath, '/images/avatars/')) {
        // Compatibilidade com fotos enviadas antes de setembro de 2026.
        $baseDirectory = $projectRoot;
        $relativePath = ltrim($storedPath, '/');
    } else {
        return null;
    }

    $baseRealPath = realpath($baseDirectory);
    $candidate = $baseDirectory . DIRECTORY_SEPARATOR
        . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    $candidateRealPath = realpath($candidate);
    if ($baseRealPath === false || $candidateRealPath === false || !is_file($candidateRealPath)) {
        return null;
    }

    $basePrefix = rtrim($baseRealPath, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if (!str_starts_with($candidateRealPath, $basePrefix)) {
        return null;
    }
    return $candidateRealPath;
}

function boolValue(mixed $value): bool
{
    return filter_var($value, FILTER_VALIDATE_BOOL);
}

function cleanString(mixed $value, int $maxLength = 255): string
{
    $text = trim((string) $value);
    return mb_substr($text, 0, $maxLength, 'UTF-8');
}

function requiredString(array $data, string $key, int $maxLength = 255): string
{
    $value = cleanString($data[$key] ?? '', $maxLength);
    if ($value === '') {
        jsonResponse(['ok' => false, 'message' => "O campo {$key} é obrigatório."], 422);
    }
    return $value;
}

function nullableInt(mixed $value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }
    $number = filter_var($value, FILTER_VALIDATE_INT);
    return $number === false ? null : $number;
}

function calculateInvestmentAccrued(int $principal, float $storedAccrued, ?string $lastAccrualAt, int $monthlyRateBasisPoints): float
{
    if ($principal <= 0 || !$lastAccrualAt || $monthlyRateBasisPoints <= 0) {
        return max(0, $storedAccrued);
    }
    $elapsedSeconds = max(0, time() - strtotime($lastAccrualAt));
    $monthlyRate = $monthlyRateBasisPoints / 10000;
    return max(0, $storedAccrued + ($principal * $monthlyRate * ($elapsedSeconds / (30 * 86400))));
}

/**
 * Gera uma oscilação diária determinística para o mercado educativo.
 * A mesma opção e a mesma data sempre produzem o mesmo resultado, portanto a
 * cotação não muda ao atualizar a página e não depende de serviços externos.
 */
function investmentDailyReturn(array $product, DateTimeImmutable $date): float
{
    $seed = (int) ($product['market_seed'] ?? $product['id'] ?? 1);
    $symbol = (string) ($product['symbol'] ?? $product['name'] ?? 'SIM');
    $key = $seed . ':' . $symbol . ':' . $date->format('Y-m-d');
    $hashA = (int) sprintf('%u', crc32($key . ':a'));
    $hashB = (int) sprintf('%u', crc32($key . ':b'));
    $noiseA = (($hashA % 100001) / 50000) - 1;
    $noiseB = (($hashB % 100001) / 50000) - 1;
    $noise = ($noiseA + $noiseB) / 2;
    $drift = ((int) ($product['daily_drift_basis_points'] ?? 0)) / 10000;
    $volatility = ((int) ($product['daily_volatility_basis_points'] ?? 0)) / 10000;

    return max(-0.25, min(0.25, $drift + ($noise * $volatility)));
}

function investmentPriceAt(array $product, DateTimeImmutable $target): float
{
    static $cache = [];

    $timezone = new DateTimeZone('America/Sao_Paulo');
    $anchorText = (string) ($product['market_anchor_date'] ?? '');
    $anchor = $anchorText !== ''
        ? DateTimeImmutable::createFromFormat('!Y-m-d', $anchorText, $timezone)
        : false;
    if (!$anchor) {
        $anchor = new DateTimeImmutable('today', $timezone);
    }
    $target = $target->setTimezone($timezone)->setTime(0, 0);
    $anchorPrice = max(1.0, (float) ($product['market_anchor_price'] ?? 100));
    $cacheKey = implode(':', [
        (int) ($product['id'] ?? 0),
        (int) ($product['market_seed'] ?? 0),
        (int) ($product['daily_drift_basis_points'] ?? 0),
        (int) ($product['daily_volatility_basis_points'] ?? 0),
        $anchor->format('Y-m-d'),
        $anchorPrice,
        $target->format('Y-m-d'),
    ]);
    if (isset($cache[$cacheKey])) {
        return $cache[$cacheKey];
    }

    $price = $anchorPrice;
    $steps = 0;
    if ($target > $anchor) {
        for ($day = $anchor->modify('+1 day'); $day <= $target && $steps < 15000; $day = $day->modify('+1 day')) {
            $price *= 1 + investmentDailyReturn($product, $day);
            $steps++;
        }
    } elseif ($target < $anchor) {
        for ($day = $anchor; $day > $target && $steps < 15000; $day = $day->modify('-1 day')) {
            $price /= max(0.01, 1 + investmentDailyReturn($product, $day));
            $steps++;
        }
    }

    $cache[$cacheKey] = max(0.01, round($price, 6));
    return $cache[$cacheKey];
}

function investmentMarketSnapshot(array $product): array
{
    $timezone = new DateTimeZone('America/Sao_Paulo');
    $today = new DateTimeImmutable('today', $timezone);
    $start = $today->modify('-30 days');
    $price = investmentPriceAt($product, $start);
    $history = [];

    for ($index = 0; $index <= 30; $index++) {
        $date = $start->modify('+' . $index . ' days');
        if ($index > 0) {
            $price = max(0.01, $price * (1 + investmentDailyReturn($product, $date)));
        }
        $history[] = [
            'date' => $date->format('d/m'),
            'isoDate' => $date->format('Y-m-d'),
            'price' => round($price, 4),
        ];
    }

    $currentPrice = (float) $history[30]['price'];
    $change = static function (float $current, float $previous): float {
        return $previous > 0 ? round((($current / $previous) - 1) * 100, 2) : 0.0;
    };

    return [
        'currentPrice' => $currentPrice,
        'changeDay' => $change($currentPrice, (float) $history[29]['price']),
        'changeWeek' => $change($currentPrice, (float) $history[23]['price']),
        'changeMonth' => $change($currentPrice, (float) $history[0]['price']),
        'history' => $history,
    ];
}

function investmentPositionUnits(array $position, float $currentPrice): float
{
    $units = (float) ($position['units'] ?? 0);
    if ($units > 0) {
        return $units;
    }

    $legacyValue = (float) ($position['principal_joys'] ?? 0) + (float) ($position['accrued_joys'] ?? 0);
    return $legacyValue > 0 && $currentPrice > 0 ? $legacyValue / $currentPrice : 0.0;
}

function routeName(): string
{
    return trim((string) ($_GET['route'] ?? ''), '/');
}

function formatFileSize(int $bytes): string
{
    if ($bytes >= 1024 * 1024) {
        return number_format($bytes / (1024 * 1024), 1, ',', '.') . ' MB';
    }
    if ($bytes >= 1024) {
        return number_format($bytes / 1024, 0, ',', '.') . ' KB';
    }
    return $bytes . ' B';
}

function writeAuditLog(
    PDO $pdo,
    ?int $userId,
    string $action,
    string $entityType,
    int|string|null $entityId = null,
    array $details = []
): void {
    $statement = $pdo->prepare("
        INSERT INTO audit_logs
            (user_id, action, entity_type, entity_id, details_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $statement->execute([
        $userId,
        mb_substr($action, 0, 80, 'UTF-8'),
        mb_substr($entityType, 0, 80, 'UTF-8'),
        $entityId === null ? null : mb_substr((string) $entityId, 0, 80, 'UTF-8'),
        $details ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        mb_substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45, 'UTF-8') ?: null,
    ]);
}

function updateStudentMedals(PDO $pdo, int $studentId): void
{
    (new AchievementService($pdo))->evaluateStudent($studentId);
}

function isModuleComplete(PDO $pdo, int $studentId, int $moduleId): bool
{
    if ($moduleId <= 0) {
        return false;
    }
    $statement = $pdo->prepare("
        SELECT COUNT(mission.id) AS total,
               COUNT(CASE WHEN progress.status = 'approved' THEN 1 END) AS approved
        FROM missions mission
        LEFT JOIN student_missions progress
          ON progress.mission_id = mission.id
         AND progress.student_id = ?
        WHERE mission.module_id = ?
          AND mission.status = 'active'
          AND mission.type = 'required'
    ");
    $statement->execute([$studentId, $moduleId]);
    $result = $statement->fetch();
    return $result && (int) $result['total'] > 0 && (int) $result['total'] === (int) $result['approved'];
}

function recordModuleCompletionIfComplete(PDO $pdo, int $studentId, int $missionId, int $recordedBy): void
{
    $moduleStatement = $pdo->prepare('SELECT module_id FROM missions WHERE id = ?');
    $moduleStatement->execute([$missionId]);
    $moduleId = (int) $moduleStatement->fetchColumn();
    if ($moduleId <= 0 || !isModuleComplete($pdo, $studentId, $moduleId)) {
        return;
    }

    $statement = $pdo->prepare("
        INSERT INTO student_module_completions
            (student_id, module_id, completion_type, completed_at, recorded_by)
        VALUES (?, ?, 'completed', NOW(), ?)
        ON DUPLICATE KEY UPDATE
            completion_type = 'completed', completed_at = NOW(), recorded_by = VALUES(recorded_by)
    ");
    $statement->execute([$studentId, $moduleId, $recordedBy]);
}

function awardMedalJoys(PDO $pdo, int $studentId, int $medalId): void
{
    $rewardStatement = $pdo->prepare('SELECT joys_reward FROM medals WHERE id = ?');
    $rewardStatement->execute([$medalId]);
    $reward = (int) $rewardStatement->fetchColumn();
    if ($reward <= 0) return;

    $balanceStatement = $pdo->prepare('SELECT joy_balance FROM students WHERE user_id = ? FOR UPDATE');
    $balanceStatement->execute([$studentId]);
    $balance = (int) $balanceStatement->fetchColumn();
    $newBalance = $balance + $reward;
    $reference = "medal:{$studentId}:{$medalId}";
    $transaction = $pdo->prepare("
        INSERT IGNORE INTO joy_transactions
            (student_id, amount, balance_after, transaction_type, reason, medal_id, reference_key)
        VALUES (?, ?, ?, 'medal_reward', 'Medalha conquistada', ?, ?)
    ");
    $transaction->execute([$studentId, $reward, $newBalance, $medalId, $reference]);
    if ($transaction->rowCount() > 0) {
        $pdo->prepare('UPDATE students SET joy_balance = ?, updated_at = NOW() WHERE user_id = ?')
            ->execute([$newBalance, $studentId]);
    }
}

function awardMissionJoys(PDO $pdo, int $studentId, int $missionId, int $createdBy): void
{
    $rewardStatement = $pdo->prepare('SELECT joys_reward FROM missions WHERE id = ?');
    $rewardStatement->execute([$missionId]);
    $reward = (int) $rewardStatement->fetchColumn();
    if ($reward <= 0) {
        return;
    }

    $balanceStatement = $pdo->prepare('SELECT joy_balance FROM students WHERE user_id = ? FOR UPDATE');
    $balanceStatement->execute([$studentId]);
    $balance = (int) $balanceStatement->fetchColumn();
    $newBalance = $balance + $reward;
    $reference = "mission:{$studentId}:{$missionId}";

    $transaction = $pdo->prepare("
        INSERT IGNORE INTO joy_transactions
            (student_id, amount, balance_after, transaction_type, reason, mission_id, created_by, reference_key)
        VALUES (?, ?, ?, 'mission_reward', 'Missão aprovada', ?, ?, ?)
    ");
    $transaction->execute([$studentId, $reward, $newBalance, $missionId, $createdBy, $reference]);

    if ($transaction->rowCount() > 0) {
        $update = $pdo->prepare('UPDATE students SET joy_balance = ?, updated_at = NOW() WHERE user_id = ?');
        $update->execute([$newBalance, $studentId]);
    }
}
