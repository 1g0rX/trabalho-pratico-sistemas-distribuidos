<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$route = routeName();
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$service = new DataService($pdo);

function contractDateValue(mixed $value, bool $withTime = false): ?string
{
    $raw = trim((string) ($value ?? ''));
    if ($raw === '') return null;
    $formats = $withTime ? ['Y-m-d\TH:i', 'Y-m-d H:i:s', 'Y-m-d H:i'] : ['Y-m-d'];
    foreach ($formats as $format) {
        $date = DateTimeImmutable::createFromFormat('!' . $format, $raw);
        $errors = DateTimeImmutable::getLastErrors();
        if ($date && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
            return $date->format($withTime ? 'Y-m-d H:i:s' : 'Y-m-d');
        }
    }
    jsonResponse(['ok' => false, 'message' => 'Confira a data informada.'], 422);
}

function financialDateWithMonthOffset(string $startDate, int $monthOffset, int $dueDay): DateTimeImmutable
{
    $start = new DateTimeImmutable($startDate . ' 12:00:00');
    $monthIndex = ((int) $start->format('Y') * 12) + ((int) $start->format('n') - 1) + $monthOffset;
    $year = intdiv($monthIndex, 12);
    $month = ($monthIndex % 12) + 1;
    $monthStart = new DateTimeImmutable(sprintf('%04d-%02d-01 12:00:00', $year, $month));
    $safeDay = min(max(1, $dueDay), (int) $monthStart->format('t'));
    return new DateTimeImmutable(sprintf('%04d-%02d-%02d 12:00:00', $year, $month, $safeDay));
}

function financialAttachmentRetentionDate(string $firstDueDate, int $installments, int $dueDay): string
{
    $lastDue = financialDateWithMonthOffset($firstDueDate, max(0, $installments - 1), $dueDay);
    return financialDateWithMonthOffset($lastDue->format('Y-m-d'), 1, $dueDay)->format('Y-m-d');
}

function resolveFinancialAttachmentPath(string $storedName, string $uploadRoot): ?string
{
    if ($storedName === '' || str_contains($storedName, '..')) return null;
    $normalized = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $storedName);
    $root = realpath($uploadRoot);
    $file = realpath($uploadRoot . DIRECTORY_SEPARATOR . ltrim($normalized, DIRECTORY_SEPARATOR));
    if (!$root || !$file || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file)) {
        return null;
    }
    return $file;
}

if ($route === 'health') {
    requireMethod('GET');
    $pdo->query('SELECT 1');
    jsonResponse(['ok' => true, 'message' => 'API e banco de dados estão funcionando.']);
}

if ($route === 'profile/avatar') {
    requireMethod('GET');
    currentUser();
    $avatarUserId = nullableInt($_GET['id'] ?? null);
    if (!$avatarUserId) {
        http_response_code(404);
        exit;
    }

    $avatarStatement = $pdo->prepare('SELECT avatar_path, avatar_mime_type FROM users WHERE id = ? LIMIT 1');
    $avatarStatement->execute([$avatarUserId]);
    $avatar = $avatarStatement->fetch();
    $avatarFile = $avatar ? resolveAvatarFilePath((string) ($avatar['avatar_path'] ?? '')) : null;
    if ($avatarFile === null) {
        http_response_code(404);
        exit;
    }

    $detectedMime = (new finfo(FILEINFO_MIME_TYPE))->file($avatarFile) ?: '';
    if (!in_array($detectedMime, ['image/jpeg', 'image/png'], true)) {
        http_response_code(404);
        exit;
    }

    $etag = '"' . hash_file('sha256', $avatarFile) . '"';
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        exit;
    }
    header('Content-Type: ' . $detectedMime);
    header('Content-Length: ' . (string) filesize($avatarFile));
    header('Content-Disposition: inline');
    header('Cache-Control: private, no-cache, must-revalidate');
    header('ETag: ' . $etag);
    readfile($avatarFile);
    exit;
}

if ($route === 'auth/login') {
    requireMethod('POST');
    $data = requestData();
    $email = mb_strtolower(requiredString($data, 'email', 190), 'UTF-8');
    $password = (string) ($data['password'] ?? '');
    $selectedRole = cleanString($data['role'] ?? '', 20);

    $statement = $pdo->prepare('SELECT id, name, email, password_hash, role, status, must_change_password FROM users WHERE email = ? LIMIT 1');
    $statement->execute([$email]);
    $account = $statement->fetch();

    if (!$account || $account['status'] !== 'active' || !password_verify($password, $account['password_hash'])) {
        usleep(250000);
        jsonResponse(['ok' => false, 'message' => 'E-mail ou senha inválidos.'], 401);
    }
    $managementLogin = $selectedRole === 'admin'
        && in_array($account['role'], ['supervisor', 'admin', 'finance', 'administrative'], true);
    if ($selectedRole !== '' && $selectedRole !== $account['role'] && !$managementLogin) {
        jsonResponse(['ok' => false, 'message' => 'O perfil selecionado não corresponde a esta conta.'], 403);
    }

    session_regenerate_id(true);
    $user = [
        'id' => (int) $account['id'],
        'name' => $account['name'],
        'email' => $account['email'],
        'role' => $account['role'],
        'initials' => initials($account['name']),
        'mustChangePassword' => (bool) $account['must_change_password'],
    ];
    $_SESSION['user'] = $user;
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([(int) $account['id']]);
    if ($user['role'] === 'student') {
        try {
            updateStudentMedals($pdo, (int) $user['id']);
        } catch (Throwable $exception) {
            error_log('[CreateJoy][achievement-login] ' . $exception->getMessage());
        }
    }

    jsonResponse([
        'ok' => true,
        'user' => $user,
        'csrfToken' => csrfToken(),
        'data' => $service->bootstrap($user),
    ]);
}

if ($route === 'auth/me') {
    requireMethod('GET');
    if (empty($_SESSION['user'])) {
        jsonResponse(['ok' => false, 'authenticated' => false], 401);
    }
    $user = currentUser();
    if ($user['role'] === 'student') {
        try {
            updateStudentMedals($pdo, (int) $user['id']);
        } catch (Throwable $exception) {
            error_log('[CreateJoy][achievement-session] ' . $exception->getMessage());
        }
    }
    jsonResponse([
        'ok' => true,
        'authenticated' => true,
        'user' => $user,
        'csrfToken' => csrfToken(),
        'data' => $service->bootstrap($user),
    ]);
}

if ($route === 'auth/logout') {
    requireMethod('POST');
    currentUser();
    requireCsrf();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    jsonResponse(['ok' => true]);
}

if ($route === 'auth/change-password') {
    requireMethod('POST', 'PUT');
    $user = currentUser();
    requireCsrf();
    $data = requestData();
    $currentPassword = (string) ($data['currentPassword'] ?? '');
    $newPassword = (string) ($data['newPassword'] ?? '');
    if (strlen($newPassword) < 8) {
        jsonResponse(['ok' => false, 'message' => 'A nova senha deve ter pelo menos 8 caracteres.'], 422);
    }
    $statement = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $statement->execute([(int) $user['id']]);
    $hash = $statement->fetchColumn();
    if (!$hash || !password_verify($currentPassword, (string) $hash)) {
        jsonResponse(['ok' => false, 'message' => 'A senha atual está incorreta.'], 422);
    }
    $update = $pdo->prepare("
        UPDATE users
        SET password_hash = ?, must_change_password = 0,
            password_changed_at = NOW(), updated_at = NOW()
        WHERE id = ?
    ");
    $update->execute([password_hash($newPassword, PASSWORD_DEFAULT), (int) $user['id']]);
    $_SESSION['user']['mustChangePassword'] = false;
    session_regenerate_id(true);
    jsonResponse(['ok' => true, 'message' => 'Senha alterada com sucesso.']);
}

if ($route === 'profile/update') {
    requireMethod('POST', 'PUT');
    $user = requirePermission($pdo, 'profile.edit_own');
    requireCsrf();
    $data = requestData();
    $name = requiredString($data, 'name', 120);
    $email = mb_strtolower(requiredString($data, 'email', 190), 'UTF-8');
    $phone = cleanString($data['phone'] ?? '', 30);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['ok' => false, 'message' => 'Informe um e-mail válido.'], 422);
    }

    $duplicate = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1');
    $duplicate->execute([$email, (int) $user['id']]);
    if ($duplicate->fetch()) {
        jsonResponse(['ok' => false, 'message' => 'Este e-mail já está sendo utilizado por outra conta.'], 409);
    }

    $previousAvatarStatement = $pdo->prepare('SELECT avatar_path FROM users WHERE id = ?');
    $previousAvatarStatement->execute([(int) $user['id']]);
    $previousAvatarPath = (string) ($previousAvatarStatement->fetchColumn() ?: '');

    $avatarPath = null;
    $avatarMime = null;
    $avatarSize = null;
    $avatarAbsolutePath = null;
    if (!empty($_FILES['avatar']) && is_array($_FILES['avatar'])) {
        $avatar = $_FILES['avatar'];
        $avatarError = (int) ($avatar['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($avatarError !== UPLOAD_ERR_NO_FILE) {
            if ($avatarError !== UPLOAD_ERR_OK) {
                jsonResponse(['ok' => false, 'message' => 'Não foi possível receber a foto selecionada.'], 422);
            }
            $avatarSize = (int) ($avatar['size'] ?? 0);
            if ($avatarSize <= 0 || $avatarSize > (int) $config['uploads']['max_image_size']) {
                jsonResponse(['ok' => false, 'message' => 'A foto deve ter no máximo 1,5 MB.'], 422);
            }
            $temporaryPath = (string) ($avatar['tmp_name'] ?? '');
            $avatarMime = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath) ?: '';
            $allowedAvatarTypes = [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
            ];
            if (!isset($allowedAvatarTypes[$avatarMime]) || @getimagesize($temporaryPath) === false) {
                jsonResponse(['ok' => false, 'message' => 'Envie uma foto válida em JPG ou PNG.'], 422);
            }
            $relativeDirectory = date('Y') . '/' . date('m');
            $targetDirectory = rtrim((string) $config['uploads']['avatar_directory'], DIRECTORY_SEPARATOR)
                . DIRECTORY_SEPARATOR . date('Y') . DIRECTORY_SEPARATOR . date('m');
            if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0750, true) && !is_dir($targetDirectory)) {
                throw new RuntimeException('Não foi possível criar a pasta da foto de perfil.');
            }
            $storedName = bin2hex(random_bytes(20)) . '.' . $allowedAvatarTypes[$avatarMime];
            $avatarAbsolutePath = $targetDirectory . DIRECTORY_SEPARATOR . $storedName;
            if (!move_uploaded_file($temporaryPath, $avatarAbsolutePath)) {
                throw new RuntimeException('Não foi possível armazenar a foto de perfil.');
            }
            $avatarPath = 'avatars/' . $relativeDirectory . '/' . $storedName;
        }
    }

    try {
        if ($avatarPath !== null) {
            $update = $pdo->prepare("
                UPDATE users
                SET name = ?, email = ?, phone = ?, avatar_path = ?,
                    avatar_mime_type = ?, avatar_file_size = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $update->execute([$name, $email, $phone ?: null, $avatarPath, $avatarMime, $avatarSize, (int) $user['id']]);
        } else {
            $update = $pdo->prepare('UPDATE users SET name = ?, email = ?, phone = ?, updated_at = NOW() WHERE id = ?');
            $update->execute([$name, $email, $phone ?: null, (int) $user['id']]);
        }
    } catch (Throwable $exception) {
        if ($avatarAbsolutePath !== null && is_file($avatarAbsolutePath)) {
            @unlink($avatarAbsolutePath);
        }
        throw $exception;
    }

    if ($avatarPath !== null) {
        $previousAvatarFile = resolveAvatarFilePath($previousAvatarPath);
        if ($previousAvatarFile !== null) @unlink($previousAvatarFile);
    }

    $_SESSION['user']['name'] = $name;
    $_SESSION['user']['email'] = $email;
    $_SESSION['user']['initials'] = initials($name);
    writeAuditLog($pdo, (int) $user['id'], 'update', 'own_profile', (int) $user['id'], [
        'avatar_updated' => $avatarPath !== null,
    ]);

    $updatedUser = $_SESSION['user'];
    jsonResponse([
        'ok' => true,
        'message' => 'Perfil atualizado com sucesso.',
        'user' => $updatedUser,
        'data' => $service->bootstrap($updatedUser),
    ]);
}

if ($route === 'bootstrap') {
    requireMethod('GET');
    $user = currentUser();
    if ($user['role'] === 'student') {
        try {
            updateStudentMedals($pdo, (int) $user['id']);
        } catch (Throwable $exception) {
            error_log('[CreateJoy][achievement-refresh] ' . $exception->getMessage());
        }
    }
    jsonResponse(['ok' => true, 'data' => $service->bootstrap($user)]);
}

if ($route === 'achievements/catalog/sync') {
    requireMethod('POST');
    $admin = requirePermission($pdo, 'curriculum.manage');
    requireCsrf();
    if (!in_array($admin['role'], ['supervisor', 'admin'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Somente a Supervisão ou o Admin pode carregar o catálogo.'], 403);
    }

    $achievementService = new AchievementService($pdo);
    $pdo->beginTransaction();
    try {
        $result = $achievementService->syncCatalog();
        $students = $pdo->query("SELECT user_id FROM students WHERE status <> 'inativo'")->fetchAll(PDO::FETCH_COLUMN);
        $newAwards = 0;
        foreach ($students as $studentId) {
            $newAwards += count($achievementService->evaluateStudent((int) $studentId));
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    writeAuditLog($pdo, (int) $admin['id'], 'sync', 'achievement_catalog', null, [
        'inserted' => $result['inserted'],
        'available' => $result['available'],
        'automatic_awards' => $newAwards,
    ]);
    jsonResponse([
        'ok' => true,
        'message' => $result['inserted'] > 0
            ? $result['inserted'] . ' medalhas e conquistas foram adicionadas com segurança.'
            : 'O catálogo já estava atualizado; nenhum cadastro existente foi alterado.',
        'data' => $service->bootstrap($admin),
    ]);
}

if ($route === 'achievements/grant') {
    requireMethod('POST');
    $actor = requirePermission($pdo, 'students.view_assigned');
    requireCsrf();
    if (!in_array($actor['role'], ['teacher', 'supervisor', 'admin'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Você não tem permissão para conceder conquistas.'], 403);
    }
    $data = requestData();
    $studentId = nullableInt($data['student_id'] ?? null);
    $medalId = nullableInt($data['medal_id'] ?? null);
    $notes = requiredString($data, 'notes', 500);
    if (!$studentId || !$medalId) {
        jsonResponse(['ok' => false, 'message' => 'Selecione um aluno e uma conquista.'], 422);
    }

    $studentCheck = $pdo->prepare("\n        SELECT account.id, account.name, class.teacher_user_id\n        FROM users account\n        JOIN students student ON student.user_id = account.id\n        LEFT JOIN classes class ON class.id = student.class_id\n        WHERE account.id = ? AND account.role = 'student'\n        LIMIT 1\n    ");
    $studentCheck->execute([$studentId]);
    $student = $studentCheck->fetch();
    if (!$student) jsonResponse(['ok' => false, 'message' => 'Aluno não encontrado.'], 404);
    if ($actor['role'] === 'teacher' && (int) ($student['teacher_user_id'] ?? 0) !== (int) $actor['id']) {
        jsonResponse(['ok' => false, 'message' => 'Este aluno não pertence às suas turmas.'], 403);
    }

    $medalCheck = $pdo->prepare("SELECT id, name, criteria_type FROM medals WHERE id = ? AND status = 'active' LIMIT 1");
    $medalCheck->execute([$medalId]);
    $medal = $medalCheck->fetch();
    if (!$medal) jsonResponse(['ok' => false, 'message' => 'Conquista não encontrada ou inativa.'], 404);
    if (!AchievementService::canGrant($actor, (string) $medal['criteria_type'])) {
        jsonResponse(['ok' => false, 'message' => 'Esta conquista é automática ou exclusiva da supervisão.'], 403);
    }

    $pdo->beginTransaction();
    try {
        $inserted = (new AchievementService($pdo))->grant($studentId, $medalId, (int) $actor['id'], $notes);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    writeAuditLog($pdo, (int) $actor['id'], 'grant', 'student_medal', $medalId, [
        'student_id' => $studentId,
        'notes' => $notes,
    ]);
    jsonResponse([
        'ok' => true,
        'message' => $inserted
            ? $medal['name'] . ' foi concedida a ' . $student['name'] . '.'
            : 'O aluno já possui esta conquista.',
        'data' => $service->bootstrap($actor),
    ]);
}

if ($route === 'teacher/student/joy-adjust') {
    requireMethod('POST');
    $actor = currentUser();
    $actor = requirePermission($pdo, in_array($actor['role'], ['supervisor', 'admin'], true) ? 'students.manage' : 'students.view_assigned');
    requireCsrf();
    if (!in_array($actor['role'], ['teacher', 'supervisor', 'admin'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Você não tem permissão para alterar Joys.'], 403);
    }

    $data = requestData();
    $studentId = nullableInt($data['student_id'] ?? null);
    $operation = cleanString($data['operation'] ?? '', 20);
    $amount = nullableInt($data['amount'] ?? null);
    $reason = requiredString($data, 'reason', 255);
    if (!$studentId || !$amount || $amount < 1 || $amount > 100000 || !in_array($operation, ['add', 'remove'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Informe uma operação e uma quantidade válida de Joys.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $studentSql = "
            SELECT s.joy_balance, u.name
            FROM students s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN classes c ON c.id = s.class_id
            WHERE s.user_id = ? AND u.role = 'student'
        ";
        $studentParams = [$studentId];
        if ($actor['role'] === 'teacher') {
            $studentSql .= ' AND c.teacher_user_id = ?';
            $studentParams[] = (int) $actor['id'];
        }
        $studentSql .= "
            FOR UPDATE
        ";
        $studentStatement = $pdo->prepare($studentSql);
        $studentStatement->execute($studentParams);
        $student = $studentStatement->fetch();
        if (!$student) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Aluno não encontrado nas suas turmas.'], 404);
        }

        $signedAmount = $operation === 'add' ? $amount : -$amount;
        $newBalance = (int) $student['joy_balance'] + $signedAmount;
        if ($newBalance < 0) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'O aluno não possui Joys suficientes para essa retirada.'], 409);
        }
        if ($newBalance > 1000000) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'O saldo final não pode ultrapassar 1.000.000 de Joys.'], 422);
        }

        $pdo->prepare('UPDATE students SET joy_balance = ?, updated_at = NOW() WHERE user_id = ?')
            ->execute([$newBalance, $studentId]);
        $transaction = $pdo->prepare("
            INSERT INTO joy_transactions
                (student_id, amount, balance_after, transaction_type, reason, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $transaction->execute([
            $studentId,
            $signedAmount,
            $newBalance,
            $actor['role'] === 'teacher'
                ? ($operation === 'add' ? 'teacher_credit' : 'teacher_debit')
                : ($operation === 'add' ? 'management_credit' : 'management_debit'),
            $reason,
            (int) $actor['id'],
        ]);
        $transactionId = (int) $pdo->lastInsertId();
        writeAuditLog($pdo, (int) $actor['id'], $operation === 'add' ? 'credit' : 'debit', 'student_joys', $studentId, [
            'transaction_id' => $transactionId,
            'amount' => $signedAmount,
            'balance_after' => $newBalance,
        ]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    jsonResponse([
        'ok' => true,
        'message' => $operation === 'add' ? 'Joys adicionados ao aluno.' : 'Joys retirados do aluno.',
        'data' => $service->bootstrap($actor),
    ]);
}

if ($route === 'student/lab-notes') {
    requireMethod('PUT', 'POST');
    $user = requireRole('student');
    requireCsrf();
    $data = requestData();
    $notes = cleanString($data['notes'] ?? '', 10000);
    $statement = $pdo->prepare('UPDATE students SET lab_notes = ?, updated_at = NOW() WHERE user_id = ?');
    $statement->execute([$notes, (int) $user['id']]);
    jsonResponse(['ok' => true, 'message' => 'Anotações salvas.']);
}

if ($route === 'store/request/create') {
    requireMethod('POST');
    $user = requireRole('student');
    requireCsrf();
    $data = requestData();
    $productId = nullableInt($data['product_id'] ?? null);
    $details = requiredString($data, 'details', 2000);
    if (!$productId) {
        jsonResponse(['ok' => false, 'message' => 'Produto inválido.'], 422);
    }

    $pdo->beginTransaction();
    try {
        // O bloqueio serializa solicitações concorrentes para o mesmo produto.
        $productStatement = $pdo->prepare("
            SELECT product.id, product.name, product.price_joys, product.inventory_mode,
                   product.stock_quantity, student.joy_balance
            FROM store_products product
            JOIN students student ON student.user_id = ?
            WHERE product.id = ? AND product.status = 'active'
            LIMIT 1
            FOR UPDATE
        ");
        $productStatement->execute([(int) $user['id'], $productId]);
        $product = $productStatement->fetch();
        if (!$product) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Produto não encontrado.'], 404);
        }
        if ((int) $product['joy_balance'] < (int) $product['price_joys']) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Você ainda não possui Joys suficientes para esta solicitação.'], 409);
        }
        $pendingStatement = $pdo->prepare("
            SELECT id FROM store_purchase_requests
            WHERE student_id = ? AND product_id = ? AND status = 'pending'
            LIMIT 1
        ");
        $pendingStatement->execute([(int) $user['id'], $productId]);
        if ($pendingStatement->fetch()) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Você já possui uma solicitação pendente para este produto.'], 409);
        }
        if ($product['inventory_mode'] !== 'unlimited') {
            $reservedStatement = $pdo->prepare("SELECT COUNT(*) FROM store_purchase_requests WHERE product_id = ? AND status = 'pending'");
            $reservedStatement->execute([$productId]);
            $available = (int) ($product['stock_quantity'] ?? 0) - (int) $reservedStatement->fetchColumn();
            if ($available < 1) {
                $pdo->rollBack();
                jsonResponse(['ok' => false, 'message' => 'Este produto está esgotado ou todas as unidades já estão reservadas.'], 409);
            }
        }

        $statement = $pdo->prepare("
            INSERT INTO store_purchase_requests
                (student_id, product_id, product_name, total_joys, request_details)
            VALUES (?, ?, ?, ?, ?)
        ");
        $statement->execute([
            (int) $user['id'],
            $productId,
            $product['name'],
            (int) $product['price_joys'],
            $details,
        ]);
        $requestId = (int) $pdo->lastInsertId();
        writeAuditLog($pdo, (int) $user['id'], 'request', 'store_purchase', $requestId, [
            'product_id' => $productId,
            'total_joys' => (int) $product['price_joys'],
        ]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    jsonResponse([
        'ok' => true,
        'message' => 'Solicitação enviada. Os Joys serão retirados somente após a aprovação.',
        'data' => $service->bootstrap($user),
    ], 201);
}

if ($route === 'store/request/cancel') {
    requireMethod('POST', 'DELETE');
    $user = requireRole('student');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id) {
        jsonResponse(['ok' => false, 'message' => 'Solicitação inválida.'], 422);
    }
    $statement = $pdo->prepare("
        UPDATE store_purchase_requests
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ? AND student_id = ? AND status = 'pending'
    ");
    $statement->execute([$id, (int) $user['id']]);
    if ($statement->rowCount() === 0) {
        jsonResponse(['ok' => false, 'message' => 'Esta solicitação não pode mais ser cancelada.'], 409);
    }
    writeAuditLog($pdo, (int) $user['id'], 'cancel', 'store_purchase', $id);
    jsonResponse(['ok' => true, 'message' => 'Solicitação cancelada.', 'data' => $service->bootstrap($user)]);
}

if ($route === 'store/request/review') {
    requireMethod('POST', 'PUT');
    $reviewer = requirePermission($pdo, 'store.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $decision = cleanString($data['decision'] ?? '', 20);
    $notes = cleanString($data['notes'] ?? '', 1000);
    if (!$id || !in_array($decision, ['approved', 'rejected'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Análise inválida.'], 422);
    }
    if ($decision === 'rejected' && $notes === '') {
        jsonResponse(['ok' => false, 'message' => 'Informe ao aluno o motivo da recusa.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $requestStatement = $pdo->prepare("
            SELECT request.id, request.student_id, request.product_id, request.product_name,
                   request.total_joys, request.status,
                   product.inventory_mode, product.stock_quantity
            FROM store_purchase_requests request
            JOIN store_products product ON product.id = request.product_id
            WHERE request.id = ?
            FOR UPDATE
        ");
        $requestStatement->execute([$id]);
        $purchase = $requestStatement->fetch();
        if (!$purchase) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Solicitação não encontrada.'], 404);
        }
        if ($purchase['status'] !== 'pending') {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Esta solicitação já foi analisada.'], 409);
        }

        $transactionId = null;
        if ($decision === 'approved') {
            if ($purchase['inventory_mode'] !== 'unlimited' && (int) ($purchase['stock_quantity'] ?? 0) < 1) {
                $pdo->rollBack();
                jsonResponse(['ok' => false, 'message' => 'Este produto ficou esgotado e o pedido não pode ser aprovado.'], 409);
            }
            $balanceStatement = $pdo->prepare('SELECT joy_balance FROM students WHERE user_id = ? FOR UPDATE');
            $balanceStatement->execute([(int) $purchase['student_id']]);
            $balance = (int) $balanceStatement->fetchColumn();
            $cost = (int) $purchase['total_joys'];
            if ($balance < $cost) {
                $pdo->rollBack();
                jsonResponse(['ok' => false, 'message' => 'O aluno não possui mais Joys suficientes para aprovar a compra.'], 409);
            }
            $newBalance = $balance - $cost;
            $reference = 'store_request:' . $id;
            $transaction = $pdo->prepare("
                INSERT INTO joy_transactions
                    (student_id, amount, balance_after, transaction_type, reason, created_by, reference_key)
                VALUES (?, ?, ?, 'store_purchase', ?, ?, ?)
            ");
            $transaction->execute([
                (int) $purchase['student_id'],
                -$cost,
                $newBalance,
                'Compra aprovada: ' . $purchase['product_name'],
                (int) $reviewer['id'],
                $reference,
            ]);
            $transactionId = (int) $pdo->lastInsertId();
            $pdo->prepare('UPDATE students SET joy_balance = ?, updated_at = NOW() WHERE user_id = ?')
                ->execute([$newBalance, (int) $purchase['student_id']]);
            if ($purchase['inventory_mode'] !== 'unlimited') {
                $stockUpdate = $pdo->prepare("
                    UPDATE store_products
                    SET stock_quantity = stock_quantity - 1, updated_at = NOW()
                    WHERE id = ? AND inventory_mode = 'limited' AND stock_quantity > 0
                ");
                $stockUpdate->execute([(int) $purchase['product_id']]);
                if ($stockUpdate->rowCount() !== 1) {
                    throw new RuntimeException('O estoque do produto mudou durante a aprovação.');
                }
            }
        }

        $update = $pdo->prepare("
            UPDATE store_purchase_requests
            SET status = ?, reviewed_by = ?, review_notes = ?, joy_transaction_id = ?,
                reviewed_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ");
        $update->execute([$decision, (int) $reviewer['id'], $notes ?: null, $transactionId, $id]);
        writeAuditLog($pdo, (int) $reviewer['id'], $decision === 'approved' ? 'approve' : 'reject', 'store_purchase', $id, [
            'student_id' => (int) $purchase['student_id'],
            'total_joys' => (int) $purchase['total_joys'],
        ]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }

    jsonResponse([
        'ok' => true,
        'message' => $decision === 'approved' ? 'Compra aprovada e Joys retirados.' : 'Solicitação recusada.',
        'data' => $service->bootstrap($reviewer),
    ]);
}

if ($route === 'investments/deposit') {
    requireMethod('POST');
    $student = requireRole('student');
    requireCsrf();
    $data = requestData();
    $productId = nullableInt($data['product_id'] ?? null);
    $amount = nullableInt($data['amount'] ?? null);
    if (!$productId || !$amount || $amount < 1 || $amount > 1000000) {
        jsonResponse(['ok' => false, 'message' => 'Informe uma quantidade válida de Joys.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $productStatement = $pdo->prepare("
            SELECT id, name, symbol, asset_type, minimum_joys,
                   daily_drift_basis_points, daily_volatility_basis_points,
                   market_seed, market_anchor_date, market_anchor_price
            FROM investment_products
            WHERE id = ? AND status = 'active'
            FOR UPDATE
        ");
        $productStatement->execute([$productId]);
        $product = $productStatement->fetch();
        if (!$product) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Investimento não encontrado.'], 404);
        }
        if ($amount < (int) $product['minimum_joys']) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'O aporte mínimo é de ' . (int) $product['minimum_joys'] . ' Joys.'], 422);
        }

        $balanceStatement = $pdo->prepare('SELECT joy_balance FROM students WHERE user_id = ? FOR UPDATE');
        $balanceStatement->execute([(int) $student['id']]);
        $balance = $balanceStatement->fetchColumn();
        if ($balance === false || (int) $balance < $amount) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Seu saldo disponível não é suficiente para este aporte.'], 409);
        }

        $positionStatement = $pdo->prepare("
            SELECT id, principal_joys, accrued_joys, last_accrual_at, units
            FROM student_investments
            WHERE student_id = ? AND product_id = ?
            FOR UPDATE
        ");
        $positionStatement->execute([(int) $student['id'], $productId]);
        $position = $positionStatement->fetch();
        $principal = $position ? (int) $position['principal_joys'] : 0;
        $market = investmentMarketSnapshot($product);
        $currentPrice = (float) $market['currentPrice'];
        $currentUnits = $position ? investmentPositionUnits($position, $currentPrice) : 0.0;
        $newUnits = $currentUnits + ($amount / $currentPrice);
        $newPrincipal = $principal + $amount;
        $profitLossSnapshot = ($newUnits * $currentPrice) - $newPrincipal;
        $storedAccrued = max(0, $profitLossSnapshot);
        $newBalance = (int) $balance - $amount;

        if ($position) {
            $pdo->prepare('UPDATE student_investments SET principal_joys = ?, accrued_joys = ?, units = ?, last_accrual_at = NOW(), updated_at = NOW() WHERE id = ?')
                ->execute([$newPrincipal, $storedAccrued, $newUnits, (int) $position['id']]);
        } else {
            $pdo->prepare('INSERT INTO student_investments (student_id, product_id, principal_joys, accrued_joys, units, last_accrual_at) VALUES (?, ?, ?, ?, ?, NOW())')
                ->execute([(int) $student['id'], $productId, $newPrincipal, $storedAccrued, $newUnits]);
        }
        $pdo->prepare('UPDATE students SET joy_balance = ?, updated_at = NOW() WHERE user_id = ?')
            ->execute([$newBalance, (int) $student['id']]);
        $pdo->prepare("
            INSERT INTO joy_transactions (student_id, amount, balance_after, transaction_type, reason, reference_key)
            VALUES (?, ?, ?, 'investment_deposit', ?, ?)
        ")->execute([
            (int) $student['id'], -$amount, $newBalance,
            'Aporte educativo em ' . $product['name'],
            'investment_deposit:' . (int) $student['id'] . ':' . $productId . ':' . bin2hex(random_bytes(8)),
        ]);
        $pdo->prepare("
            INSERT INTO investment_transactions
                (student_id, product_id, transaction_type, amount_joys, principal_after, earnings_after, joy_balance_after)
            VALUES (?, ?, 'deposit', ?, ?, ?, ?)
        ")->execute([(int) $student['id'], $productId, $amount, $newPrincipal, $storedAccrued, $newBalance]);
        writeAuditLog($pdo, (int) $student['id'], 'deposit', 'student_investment', $productId, ['amount' => $amount]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    jsonResponse(['ok' => true, 'message' => 'Investimento realizado. Agora você pode acompanhar as oscilações simuladas.', 'data' => $service->bootstrap($student)]);
}

if ($route === 'investments/withdraw') {
    requireMethod('POST');
    $student = requireRole('student');
    requireCsrf();
    $data = requestData();
    $productId = nullableInt($data['product_id'] ?? null);
    $amount = nullableInt($data['amount'] ?? null);
    if (!$productId || !$amount || $amount < 1 || $amount > 1000000) {
        jsonResponse(['ok' => false, 'message' => 'Informe uma quantidade válida de Joys.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $productStatement = $pdo->prepare("
            SELECT id, name, symbol, asset_type,
                   daily_drift_basis_points, daily_volatility_basis_points,
                   market_seed, market_anchor_date, market_anchor_price
            FROM investment_products
            WHERE id = ?
            FOR UPDATE
        ");
        $productStatement->execute([$productId]);
        $product = $productStatement->fetch();
        $positionStatement = $pdo->prepare("
            SELECT id, principal_joys, accrued_joys, last_accrual_at, units
            FROM student_investments
            WHERE student_id = ? AND product_id = ?
            FOR UPDATE
        ");
        $positionStatement->execute([(int) $student['id'], $productId]);
        $position = $positionStatement->fetch();
        if (!$product || !$position) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Você ainda não possui Joys nesta opção.'], 404);
        }
        $principal = (int) $position['principal_joys'];
        $market = investmentMarketSnapshot($product);
        $currentPrice = (float) $market['currentPrice'];
        $currentUnits = investmentPositionUnits($position, $currentPrice);
        $marketValue = $currentUnits * $currentPrice;
        $available = (int) floor(max(0, $marketValue));
        if ($amount > $available) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'O valor solicitado é maior que o total disponível neste investimento.'], 409);
        }

        $unitsWithdrawal = min($currentUnits, $amount / $currentPrice);
        $withdrawalRatio = $currentUnits > 0 ? min(1, $unitsWithdrawal / $currentUnits) : 0;
        $principalWithdrawal = min($principal, (int) round($principal * $withdrawalRatio));
        $newUnits = max(0, $currentUnits - $unitsWithdrawal);
        $newPrincipal = max(0, $principal - $principalWithdrawal);
        $newProfitLoss = ($newUnits * $currentPrice) - $newPrincipal;
        $newAccrued = max(0, $newProfitLoss);
        $balanceStatement = $pdo->prepare('SELECT joy_balance FROM students WHERE user_id = ? FOR UPDATE');
        $balanceStatement->execute([(int) $student['id']]);
        $newBalance = (int) $balanceStatement->fetchColumn() + $amount;
        if ($newBalance > 1000000) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'A retirada ultrapassaria o limite de 1.000.000 de Joys na carteira.'], 409);
        }

        $pdo->prepare('UPDATE student_investments SET principal_joys = ?, accrued_joys = ?, units = ?, last_accrual_at = NOW(), updated_at = NOW() WHERE id = ?')
            ->execute([$newPrincipal, $newAccrued, $newUnits, (int) $position['id']]);
        $pdo->prepare('UPDATE students SET joy_balance = ?, updated_at = NOW() WHERE user_id = ?')
            ->execute([$newBalance, (int) $student['id']]);
        $pdo->prepare("
            INSERT INTO joy_transactions (student_id, amount, balance_after, transaction_type, reason, reference_key)
            VALUES (?, ?, ?, 'investment_withdraw', ?, ?)
        ")->execute([
            (int) $student['id'], $amount, $newBalance,
            'Retirada educativa de ' . $product['name'],
            'investment_withdraw:' . (int) $student['id'] . ':' . $productId . ':' . bin2hex(random_bytes(8)),
        ]);
        $pdo->prepare("
            INSERT INTO investment_transactions
                (student_id, product_id, transaction_type, amount_joys, principal_after, earnings_after, joy_balance_after)
            VALUES (?, ?, 'withdraw', ?, ?, ?, ?)
        ")->execute([(int) $student['id'], $productId, $amount, $newPrincipal, $newAccrued, $newBalance]);
        writeAuditLog($pdo, (int) $student['id'], 'withdraw', 'student_investment', $productId, ['amount' => $amount]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    jsonResponse(['ok' => true, 'message' => 'Retirada concluída. Os Joys voltaram para sua carteira.', 'data' => $service->bootstrap($student)]);
}

if ($route === 'student/activity/toggle') {
    requireMethod('POST');
    $user = requireRole('student');
    requireCsrf();
    $data = requestData();
    $activityId = nullableInt($data['activity_id'] ?? null);
    $completed = filter_var($data['completed'] ?? false, FILTER_VALIDATE_BOOLEAN);
    if (!$activityId) {
        jsonResponse(['ok' => false, 'message' => 'Atividade inválida.'], 422);
    }

    $activity = $pdo->prepare("
        SELECT activity.id, activity.type, COALESCE(mission_progress.status, 'available') AS mission_progress_status
        FROM activities activity
        JOIN missions mission ON mission.id = activity.mission_id
        JOIN students student ON student.user_id = ? AND student.current_module_id = mission.module_id
        LEFT JOIN student_missions mission_progress
          ON mission_progress.mission_id = mission.id
         AND mission_progress.student_id = student.user_id
        WHERE activity.id = ? AND activity.status = 'active' AND mission.status = 'active'
        LIMIT 1
    ");
    $activity->execute([(int) $user['id'], $activityId]);
    $activityData = $activity->fetch();
    if (!$activityData || in_array($activityData['type'], ['arquivo', 'file'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Esta atividade não pode ser marcada.'], 403);
    }
    if ($activityData['mission_progress_status'] === 'approved') {
        jsonResponse(['ok' => false, 'message' => 'O checklist de uma missão já aprovada não pode ser alterado.'], 409);
    }

    if ($completed && in_array($activityData['type'], ['desafio', 'challenge', 'extra'], true)) {
        $hasPrerequisite = $pdo->prepare('SELECT COUNT(*) FROM activity_prerequisites WHERE activity_id = ?');
        $hasPrerequisite->execute([$activityId]);
        $blocked = $pdo->prepare("
            SELECT COUNT(*)
            FROM activity_prerequisites prerequisite
            LEFT JOIN student_activity_progress progress
              ON progress.activity_id = prerequisite.prerequisite_activity_id
             AND progress.student_id = ?
            WHERE prerequisite.activity_id = ?
              AND COALESCE(progress.status, 'pending') <> 'completed'
        ");
        $blocked->execute([(int) $user['id'], $activityId]);
        if ((int) $hasPrerequisite->fetchColumn() === 0 || (int) $blocked->fetchColumn() > 0) {
            jsonResponse(['ok' => false, 'message' => 'Conclua a atividade obrigatória indicada antes deste desafio extra.'], 409);
        }
    }

    $statement = $pdo->prepare("
        INSERT INTO student_activity_progress (student_id, activity_id, status, completed_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status = VALUES(status), completed_at = VALUES(completed_at), updated_at = NOW()
    ");
    $statement->execute([
        (int) $user['id'],
        $activityId,
        $completed ? 'completed' : 'pending',
        $completed ? date('Y-m-d H:i:s') : null,
    ]);
    jsonResponse(['ok' => true, 'message' => $completed ? 'Atividade concluída.' : 'Atividade reaberta.', 'data' => $service->bootstrap($user)]);
}

if ($route === 'submissions/create') {
    requireMethod('POST');
    $user = requireRole('student');
    requireCsrf();

    $missionId = nullableInt($_POST['mission_id'] ?? null);
    $notes = cleanString($_POST['notes'] ?? '', 10000);
    $learned = requiredString($_POST, 'learned', 10000);
    if (!$missionId) {
        jsonResponse(['ok' => false, 'message' => 'Missão inválida.'], 422);
    }

    $mission = $pdo->prepare("
        SELECT ms.id,
               CASE
                   WHEN EXISTS (
                       SELECT 1 FROM submissions approved_submission
                       WHERE approved_submission.student_id = ?
                         AND approved_submission.mission_id = ms.id
                         AND approved_submission.status IN ('approved', 'concluded')
                   ) THEN 'approved'
                   WHEN EXISTS (
                       SELECT 1
                       FROM mission_prerequisites prerequisite
                       LEFT JOIN student_missions prerequisite_progress
                         ON prerequisite_progress.mission_id = prerequisite.prerequisite_mission_id
                        AND prerequisite_progress.student_id = ?
                       WHERE prerequisite.mission_id = ms.id
                         AND COALESCE(prerequisite_progress.status, 'available') <> 'approved'
                         AND NOT EXISTS (
                             SELECT 1 FROM submissions approved_prerequisite_submission
                             WHERE approved_prerequisite_submission.student_id = student.user_id
                               AND approved_prerequisite_submission.mission_id = prerequisite.prerequisite_mission_id
                               AND approved_prerequisite_submission.status IN ('approved', 'concluded')
                         )
                   ) THEN 'blocked'
                   ELSE COALESCE(sm.status, 'available')
               END AS progress_status
        FROM missions ms
        JOIN students student ON student.user_id = ?
        LEFT JOIN student_missions sm ON sm.mission_id = ms.id AND sm.student_id = student.user_id
        WHERE ms.id = ? AND ms.status = 'active' AND ms.module_id = student.current_module_id
          AND (
              ms.type = 'required'
              OR EXISTS (SELECT 1 FROM mission_prerequisites visible_extra WHERE visible_extra.mission_id = ms.id)
          )
        LIMIT 1
    ");
    $mission->execute([(int) $user['id'], (int) $user['id'], (int) $user['id'], $missionId]);
    $missionAccess = $mission->fetch();
    if (!$missionAccess) {
        jsonResponse(['ok' => false, 'message' => 'Esta missão não está disponível para o seu módulo.'], 403);
    }
    if ($missionAccess['progress_status'] === 'blocked') {
        jsonResponse(['ok' => false, 'message' => 'Conclua as missões anteriores antes de enviar esta atividade.'], 409);
    }
    if ($missionAccess['progress_status'] === 'approved') {
        jsonResponse(['ok' => false, 'message' => 'Esta missão já foi aprovada.'], 409);
    }

    $pendingActivities = $pdo->prepare("
        SELECT COUNT(*)
        FROM activities activity
        LEFT JOIN student_activity_progress progress
          ON progress.activity_id = activity.id
         AND progress.student_id = ?
        WHERE activity.mission_id = ?
          AND activity.status = 'active'
          AND activity.type IN ('exercicio', 'exercise')
          AND COALESCE(progress.status, 'pending') <> 'completed'
    ");
    $pendingActivities->execute([(int) $user['id'], $missionId]);
    if ((int) $pendingActivities->fetchColumn() > 0) {
        jsonResponse(['ok' => false, 'message' => 'Conclua o checklist obrigatório antes de enviar a missão.'], 409);
    }

    $uploadedFiles = [];
    if (isset($_FILES['files'])) {
        $names = is_array($_FILES['files']['name']) ? $_FILES['files']['name'] : [$_FILES['files']['name']];
        $tmpNames = is_array($_FILES['files']['tmp_name']) ? $_FILES['files']['tmp_name'] : [$_FILES['files']['tmp_name']];
        $sizes = is_array($_FILES['files']['size']) ? $_FILES['files']['size'] : [$_FILES['files']['size']];
        $errors = is_array($_FILES['files']['error']) ? $_FILES['files']['error'] : [$_FILES['files']['error']];

        if (count($names) > (int) $config['uploads']['max_files_per_submission']) {
            jsonResponse(['ok' => false, 'message' => 'Envie no máximo 3 arquivos por tentativa.'], 422);
        }

        $totalUploadSize = 0;
        foreach ($names as $index => $originalName) {
            if (($errors[$index] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            if (($errors[$index] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
                jsonResponse(['ok' => false, 'message' => 'Falha ao receber um dos arquivos.'], 422);
            }
            $size = (int) ($sizes[$index] ?? 0);
            if ($size <= 0 || $size > (int) $config['uploads']['max_file_size']) {
                jsonResponse(['ok' => false, 'message' => 'Cada arquivo deve ter no máximo 5 MB.'], 422);
            }
            $safeOriginal = basename((string) $originalName);
            $extension = strtolower(pathinfo($safeOriginal, PATHINFO_EXTENSION));
            if (!in_array($extension, $config['uploads']['allowed_extensions'], true)) {
                jsonResponse(['ok' => false, 'message' => "Formato .{$extension} não permitido."], 422);
            }
            if (in_array($extension, ['png', 'jpg', 'jpeg'], true)
                && $size > (int) $config['uploads']['max_image_size']) {
                jsonResponse(['ok' => false, 'message' => 'Cada imagem deve ter no máximo 1,5 MB.'], 422);
            }
            $totalUploadSize += $size;
            if ($totalUploadSize > (int) $config['uploads']['max_total_size']) {
                jsonResponse(['ok' => false, 'message' => 'O total dos arquivos deve ter no máximo 8 MB por tentativa.'], 422);
            }
            $uploadedFiles[] = [
                'original' => mb_substr($safeOriginal, 0, 255, 'UTF-8'),
                'temporary' => $tmpNames[$index],
                'size' => $size,
                'extension' => $extension,
            ];
        }
    }

    $pdo->beginTransaction();
    $movedPaths = [];
    try {
        $attemptStatement = $pdo->prepare("
            SELECT COALESCE(MAX(attempt_number), 0) + 1
            FROM submissions
            WHERE student_id = ? AND mission_id = ?
        ");
        $attemptStatement->execute([(int) $user['id'], $missionId]);
        $attemptNumber = (int) $attemptStatement->fetchColumn();

        $statement = $pdo->prepare("
            INSERT INTO submissions
                (student_id, mission_id, attempt_number, notes, learned, status, submitted_at)
            VALUES (?, ?, ?, ?, ?, 'pending', NOW())
        ");
        $statement->execute([(int) $user['id'], $missionId, $attemptNumber, $notes, $learned]);
        $submissionId = (int) $pdo->lastInsertId();

        $missionNotes = $pdo->prepare("
            INSERT INTO mission_notes (student_id, mission_id, notes)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE notes = VALUES(notes), updated_at = NOW()
        ");
        $missionNotes->execute([(int) $user['id'], $missionId, $notes]);

        $progress = $pdo->prepare("
            INSERT INTO student_missions (student_id, mission_id, status, started_at, submitted_at)
            VALUES (?, ?, 'submitted', NOW(), NOW())
            ON DUPLICATE KEY UPDATE status = 'submitted', submitted_at = NOW()
        ");
        $progress->execute([(int) $user['id'], $missionId]);

        if ($uploadedFiles) {
            $yearMonth = date('Y') . DIRECTORY_SEPARATOR . date('m');
            $targetDirectory = $config['uploads']['directory'] . DIRECTORY_SEPARATOR . $yearMonth;
            if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0750, true) && !is_dir($targetDirectory)) {
                throw new RuntimeException('Não foi possível criar a pasta de uploads.');
            }

            $insertFile = $pdo->prepare("
                INSERT INTO submission_files
                    (submission_id, original_name, stored_name, mime_type, file_size, file_type, file_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            foreach ($uploadedFiles as $file) {
                $storedName = bin2hex(random_bytes(20)) . '.' . $file['extension'];
                $relativePath = $yearMonth . DIRECTORY_SEPARATOR . $storedName;
                $absolutePath = $config['uploads']['directory'] . DIRECTORY_SEPARATOR . $relativePath;
                if (!move_uploaded_file($file['temporary'], $absolutePath)) {
                    throw new RuntimeException('Não foi possível armazenar o arquivo enviado.');
                }
                $movedPaths[] = $absolutePath;
                $mime = $finfo->file($absolutePath) ?: 'application/octet-stream';
                $insertFile->execute([
                    $submissionId,
                    $file['original'],
                    $relativePath,
                    $mime,
                    $file['size'],
                    $file['extension'],
                    hash_file('sha256', $absolutePath) ?: null,
                ]);
            }
        }

        updateStudentMedals($pdo, (int) $user['id']);
        $pdo->commit();
        jsonResponse([
            'ok' => true,
            'message' => 'Missão enviada para avaliação.',
            'data' => $service->bootstrap($user),
        ], 201);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        foreach ($movedPaths as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }
        throw $exception;
    }
}

if ($route === 'submissions/review') {
    requireMethod('PUT', 'POST');
    $reviewer = requirePermission($pdo, 'submissions.review');
    requireCsrf();
    $data = requestData();
    $submissionId = nullableInt($data['id'] ?? null);
    $status = cleanString($data['status'] ?? '', 20);
    $feedback = cleanString($data['feedback'] ?? '', 5000);
    if (!$submissionId || !in_array($status, ['approved', 'redo'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Avaliação inválida.'], 422);
    }
    if ($status === 'redo' && $feedback === '') {
        jsonResponse(['ok' => false, 'message' => 'Explique ao aluno o que precisa ser corrigido.'], 422);
    }

    if ($reviewer['role'] === 'teacher') {
        $check = $pdo->prepare("
            SELECT sub.id
            FROM submissions sub
            JOIN students s ON s.user_id = sub.student_id
            JOIN classes c ON c.id = s.class_id
            WHERE sub.id = ? AND c.teacher_user_id = ?
        ");
        $check->execute([$submissionId, (int) $reviewer['id']]);
        if (!$check->fetch()) {
            jsonResponse(['ok' => false, 'message' => 'Esta entrega não pertence às suas turmas.'], 403);
        }
    }

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare("
            UPDATE submissions
            SET status = ?, feedback = ?, reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ?
        ");
        $update->execute([$status, $feedback, (int) $reviewer['id'], $submissionId]);

        $submission = $pdo->prepare('SELECT student_id, mission_id FROM submissions WHERE id = ?');
        $submission->execute([$submissionId]);
        $row = $submission->fetch();
        if (!$row) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'message' => 'Entrega não encontrada.'], 404);
        }
        $progress = $pdo->prepare("
            INSERT INTO student_missions (student_id, mission_id, status, approved_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status), approved_at = VALUES(approved_at)
        ");
        $progressStatus = $status === 'approved' ? 'approved' : 'redo';
        $progress->execute([
            (int) $row['student_id'],
            (int) $row['mission_id'],
            $progressStatus,
            $status === 'approved' ? date('Y-m-d H:i:s') : null,
        ]);
        if ($status === 'approved') {
            awardMissionJoys(
                $pdo,
                (int) $row['student_id'],
                (int) $row['mission_id'],
                (int) $reviewer['id']
            );
            recordModuleCompletionIfComplete(
                $pdo,
                (int) $row['student_id'],
                (int) $row['mission_id'],
                (int) $reviewer['id']
            );
            $nextMission = $pdo->prepare("
                SELECT next_mission.id
                FROM missions current_mission
                JOIN missions next_mission
                  ON next_mission.module_id = current_mission.module_id
                 AND next_mission.sort_order > current_mission.sort_order
                 AND next_mission.type = 'required'
                 AND next_mission.status = 'active'
                WHERE current_mission.id = ?
                ORDER BY next_mission.sort_order, next_mission.id
                LIMIT 1
            ");
            $nextMission->execute([(int) $row['mission_id']]);
            $nextMissionId = $nextMission->fetchColumn();
            if ($nextMissionId) {
                $unlock = $pdo->prepare("
                    INSERT INTO student_missions (student_id, mission_id, status)
                    VALUES (?, ?, 'available')
                    ON DUPLICATE KEY UPDATE status = IF(status = 'blocked', 'available', status)
                ");
                $unlock->execute([(int) $row['student_id'], (int) $nextMissionId]);
            }
        }
        updateStudentMedals($pdo, (int) $row['student_id']);
        $pdo->commit();
        writeAuditLog($pdo, (int) $reviewer['id'], 'review', 'submission', $submissionId, [
            'status' => $status,
            'student_id' => (int) $row['student_id'],
            'mission_id' => (int) $row['mission_id'],
        ]);

        jsonResponse([
            'ok' => true,
            'message' => $status === 'approved' ? 'Entrega aprovada.' : 'Entrega devolvida para refazer.',
            'data' => $service->bootstrap($reviewer),
        ]);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

if ($route === 'files/download') {
    requireMethod('GET');
    $user = currentUser();
    $fileId = nullableInt($_GET['id'] ?? null);
    if (!$fileId) {
        jsonResponse(['ok' => false, 'message' => 'Arquivo inválido.'], 422);
    }

    $statement = $pdo->prepare("
        SELECT sf.*, sub.student_id, c.teacher_user_id
        FROM submission_files sf
        JOIN submissions sub ON sub.id = sf.submission_id
        LEFT JOIN students s ON s.user_id = sub.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        WHERE sf.id = ?
    ");
    $statement->execute([$fileId]);
    $file = $statement->fetch();
    if (!$file) {
        jsonResponse(['ok' => false, 'message' => 'Arquivo não encontrado.'], 404);
    }

    $allowed = in_array($user['role'], ['supervisor', 'admin'], true)
        || (int) $file['student_id'] === (int) $user['id']
        || ($user['role'] === 'teacher' && (int) $file['teacher_user_id'] === (int) $user['id']);
    if (!$allowed) {
        jsonResponse(['ok' => false, 'message' => 'Você não tem acesso a este arquivo.'], 403);
    }

    $path = $config['uploads']['directory'] . DIRECTORY_SEPARATOR . $file['stored_name'];
    $uploadRoot = realpath($config['uploads']['directory']);
    $realPath = realpath($path);
    if (!$uploadRoot || !$realPath || !str_starts_with($realPath, $uploadRoot . DIRECTORY_SEPARATOR) || !is_file($realPath)) {
        jsonResponse(['ok' => false, 'message' => 'O arquivo não está disponível no servidor.'], 404);
    }

    header('Content-Type: ' . ($file['mime_type'] ?: 'application/octet-stream'));
    header('Content-Length: ' . filesize($realPath));
    header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($file['original_name']));
    header('Cache-Control: private, no-store');
    readfile($realPath);
    exit;
}

if ($route === 'mission-files/download') {
    requireMethod('GET');
    $user = currentUser();
    $fileId = nullableInt($_GET['id'] ?? null);
    if (!$fileId) {
        jsonResponse(['ok' => false, 'message' => 'Arquivo inválido.'], 422);
    }

    $statement = $pdo->prepare("
        SELECT support.*, mission.module_id, module.level AS module_level
        FROM mission_support_files support
        JOIN missions mission ON mission.id = support.mission_id
        JOIN modules module ON module.id = mission.module_id
        WHERE support.id = ? AND support.status = 'active'
    ");
    $statement->execute([$fileId]);
    $file = $statement->fetch();
    if (!$file) {
        jsonResponse(['ok' => false, 'message' => 'Arquivo não encontrado.'], 404);
    }

    if ($user['role'] === 'student') {
        $access = $pdo->prepare("
            SELECT 1
            FROM students student
            JOIN missions visible_mission
              ON visible_mission.id = ?
             AND visible_mission.module_id = student.current_module_id
             AND visible_mission.status = 'active'
            WHERE student.user_id = ?
              AND (
                  visible_mission.type = 'required'
                  OR (
                      EXISTS (
                          SELECT 1 FROM mission_prerequisites required_link
                          WHERE required_link.mission_id = visible_mission.id
                      )
                      AND NOT EXISTS (
                          SELECT 1
                          FROM mission_prerequisites required_link
                          LEFT JOIN student_missions required_progress
                            ON required_progress.mission_id = required_link.prerequisite_mission_id
                           AND required_progress.student_id = student.user_id
                          WHERE required_link.mission_id = visible_mission.id
                            AND COALESCE(required_progress.status, 'available') <> 'approved'
                      )
                  )
              )
        ");
        $access->execute([(int) $file['mission_id'], (int) $user['id']]);
        if (!$access->fetchColumn()) {
            jsonResponse(['ok' => false, 'message' => 'Este arquivo ainda não está disponível.'], 403);
        }
    }

    $path = $config['uploads']['directory'] . DIRECTORY_SEPARATOR . $file['stored_name'];
    $uploadRoot = realpath($config['uploads']['directory']);
    $realPath = realpath($path);
    if (!$uploadRoot || !$realPath || !str_starts_with($realPath, $uploadRoot . DIRECTORY_SEPARATOR) || !is_file($realPath)) {
        jsonResponse(['ok' => false, 'message' => 'O arquivo não está disponível no servidor.'], 404);
    }

    header('Content-Type: ' . ($file['mime_type'] ?: 'application/octet-stream'));
    header('Content-Length: ' . filesize($realPath));
    header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($file['original_name']));
    header('Cache-Control: private, no-store');
    readfile($realPath);
    exit;
}

if ($route === 'admin/user/save') {
    requireMethod('POST', 'PUT');
    $admin = currentUser();
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $isNewUser = !$id;
    $name = requiredString($data, 'name', 120);
    $email = mb_strtolower(requiredString($data, 'email', 190), 'UTF-8');
    $role = cleanString($data['role'] ?? '', 20);
    $status = cleanString($data['status'] ?? 'active', 20);
    if (!in_array($role, ['student', 'teacher', 'supervisor', 'admin', 'finance', 'administrative'], true)
        || !in_array($status, ['active', 'inactive'], true)
        || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['ok' => false, 'message' => 'Dados de usuário inválidos.'], 422);
    }
    $admin = requirePermission($pdo, $role === 'student' ? 'students.manage' : 'teachers.manage');
    if ($admin['role'] !== 'admin'
        && in_array($role, ['supervisor', 'admin', 'finance', 'administrative'], true)
        && (!$id || $id !== (int) $admin['id'])) {
        jsonResponse(['ok' => false, 'message' => 'Somente o Admin Geral pode cadastrar outros gestores.'], 403);
    }

    $password = (string) ($data['password'] ?? '');
    if ($password !== '' && strlen($password) < 8) {
        jsonResponse(['ok' => false, 'message' => 'A senha deve ter pelo menos 8 caracteres.'], 422);
    }

    $studentStatus = cleanString($data['student_status'] ?? 'ativo', 20);
    $studentClassId = nullableInt($data['class_id'] ?? null);
    $studentModuleId = nullableInt($data['module_id'] ?? null);
    $studentComputer = cleanString($data['computer_number'] ?? '', 20);
    $studentJoyProvided = array_key_exists('joy_balance', $data);
    $studentJoyBalance = nullableInt($data['joy_balance'] ?? 0) ?? 0;
    $studentGenderProvided = array_key_exists('gender', $data);
    $studentGender = cleanString($data['gender'] ?? 'not_informed', 20);
    if (!in_array($studentGender, ['male', 'female', 'not_informed', ''], true)) {
        jsonResponse(['ok' => false, 'message' => 'Gênero informado é inválido.'], 422);
    }
    $studentGenderValue = in_array($studentGender, ['male', 'female'], true) ? $studentGender : null;
    $completedModulesProvided = array_key_exists('completed_module_ids', $data);
    $completedModuleIds = $data['completed_module_ids'] ?? [];
    if (is_string($completedModuleIds)) {
        $completedModuleIds = array_filter(array_map('intval', explode(',', $completedModuleIds)));
    }
    $completedModuleIds = array_values(array_unique(array_filter(array_map('intval', is_array($completedModuleIds) ? $completedModuleIds : []))));
    $previousClassId = null;
    $previousJoyBalance = 0;
    if ($role === 'student' && !in_array($studentStatus, ['ativo', 'atrasado', 'inativo'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Status de aluno inválido.'], 422);
    }
    if ($role === 'student' && ($studentJoyBalance < 0 || $studentJoyBalance > 1000000)) {
        jsonResponse(['ok' => false, 'message' => 'O saldo de Joys deve estar entre 0 e 1.000.000.'], 422);
    }

    if ($id) {
        $targetStatement = $pdo->prepare("
            SELECT u.id, u.role, student.class_id AS current_class_id,
                   student.gender AS current_gender,
                   COALESCE(student.joy_balance, 0) AS current_joy_balance
            FROM users u
            LEFT JOIN students student ON student.user_id = u.id
            WHERE u.id = ?
            LIMIT 1
        ");
        $targetStatement->execute([$id]);
        $target = $targetStatement->fetch();
        if (!$target) {
            jsonResponse(['ok' => false, 'message' => 'Usuário não encontrado.'], 404);
        }
        if ($admin['role'] !== 'admin'
            && in_array($target['role'], ['supervisor', 'admin', 'finance', 'administrative'], true)
            && $id !== (int) $admin['id']) {
            jsonResponse(['ok' => false, 'message' => 'Somente o Admin Geral pode editar outros perfis de gestão.'], 403);
        }
        $previousClassId = nullableInt($target['current_class_id'] ?? null);
        $previousJoyBalance = (int) ($target['current_joy_balance'] ?? 0);
        if ($role === 'student' && !$studentJoyProvided) {
            $studentJoyBalance = $previousJoyBalance;
        }
        if ($role === 'student' && !$studentGenderProvided) {
            $studentGenderValue = in_array($target['current_gender'] ?? null, ['male', 'female'], true)
                ? $target['current_gender']
                : null;
        }

        $changesAccountType = ($target['role'] === 'student') !== ($role === 'student');
        if ($changesAccountType) {
            jsonResponse(['ok' => false, 'message' => 'Não é possível converter uma conta de aluno em funcionário ou vice-versa.'], 422);
        }
        if ($id === (int) $admin['id'] && ($role !== $admin['role'] || $status !== 'active')) {
            jsonResponse(['ok' => false, 'message' => 'A conta em uso deve continuar ativa e com o mesmo perfil.'], 422);
        }
    } elseif ($password === '') {
        jsonResponse(['ok' => false, 'message' => 'Informe uma senha inicial com pelo menos 8 caracteres.'], 422);
    }

    $pdo->beginTransaction();
    try {
        if ($id) {
            $statement = $pdo->prepare('UPDATE users SET name = ?, email = ?, role = ?, status = ?, updated_at = NOW() WHERE id = ?');
            $statement->execute([$name, $email, $role, $status, $id]);
            if ($password !== '') {
                $passwordStatement = $pdo->prepare("
                    UPDATE users
                    SET password_hash = ?, must_change_password = ?,
                        password_changed_at = NOW(), updated_at = NOW()
                    WHERE id = ?
                ");
                $passwordStatement->execute([
                    password_hash($password, PASSWORD_DEFAULT),
                    $id === (int) $admin['id'] ? 0 : 1,
                    $id,
                ]);
            }
            if ($role === 'student') {
                $student = $pdo->prepare("
                    INSERT INTO students (user_id, class_id, current_module_id, computer_number, status, joy_balance, gender)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE class_id = VALUES(class_id),
                                            current_module_id = VALUES(current_module_id),
                                            computer_number = VALUES(computer_number),
                                            status = VALUES(status),
                                            joy_balance = VALUES(joy_balance),
                                            gender = VALUES(gender)
                ");
                $student->execute([
                    $id,
                    $studentClassId,
                    $studentModuleId,
                    $studentComputer,
                    $studentStatus,
                    $studentJoyBalance,
                    $studentGenderValue,
                ]);
            }
        } else {
            $statement = $pdo->prepare('INSERT INTO users (name, email, password_hash, role, status, must_change_password) VALUES (?, ?, ?, ?, ?, 1)');
            $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $role, $status]);
            $id = (int) $pdo->lastInsertId();
            if ($role === 'student') {
                $student = $pdo->prepare('INSERT INTO students (user_id, class_id, current_module_id, computer_number, status, joy_balance, gender) VALUES (?, ?, ?, ?, ?, ?, ?)');
                $student->execute([
                    $id,
                    $studentClassId,
                    $studentModuleId,
                    $studentComputer,
                    $studentStatus,
                    $studentJoyBalance,
                    $studentGenderValue,
                ]);
            }
        }

        if ($role === 'student') {
            $joyDifference = $studentJoyBalance - $previousJoyBalance;
            if ($joyDifference !== 0) {
                $joyTransaction = $pdo->prepare("
                    INSERT INTO joy_transactions
                        (student_id, amount, balance_after, transaction_type, reason, created_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $joyTransaction->execute([
                    $id,
                    $joyDifference,
                    $studentJoyBalance,
                    $isNewUser ? 'initial_balance' : 'manual_adjustment',
                    $isNewUser ? 'Saldo inicial informado no cadastro' : 'Ajuste de saldo realizado no cadastro do aluno',
                    (int) $admin['id'],
                ]);
            }

            if ($completedModulesProvided || $isNewUser) {
                $pdo->prepare("DELETE FROM student_module_completions WHERE student_id = ? AND completion_type = 'recognized'")->execute([$id]);
                $insertCompletion = $pdo->prepare("
                    INSERT IGNORE INTO student_module_completions
                        (student_id, module_id, completion_type, completed_at, recorded_by)
                    SELECT ?, id, 'recognized', NOW(), ? FROM modules WHERE id = ?
                ");
                foreach ($completedModuleIds as $completedModuleId) {
                    if ($completedModuleId !== $studentModuleId) {
                        $insertCompletion->execute([$id, (int) $admin['id'], $completedModuleId]);
                    }
                }
            }

            $pdo->prepare("
                UPDATE students
                SET current_semester_id = (
                    SELECT semester_id FROM classes WHERE id = ?
                )
                WHERE user_id = ?
            ")->execute([$studentClassId, $id]);

            if ($previousClassId !== $studentClassId) {
                $pdo->prepare("
                    UPDATE class_enrollments
                    SET status = 'transferred', ended_at = CURDATE()
                    WHERE student_id = ? AND status = 'active'
                ")->execute([$id]);

                if ($studentClassId) {
                    $enrollment = $pdo->prepare("
                        INSERT INTO class_enrollments
                            (class_id, student_id, semester_id, status, enrolled_at, created_by)
                        SELECT id, ?, semester_id, 'active', CURDATE(), ?
                        FROM classes
                        WHERE id = ?
                    ");
                    $enrollment->execute([$id, (int) $admin['id'], $studentClassId]);

                    if ($previousClassId) {
                        $transfer = $pdo->prepare("
                            INSERT INTO student_transfers
                                (student_id, from_class_id, to_class_id, reason, transferred_by)
                            VALUES (?, ?, ?, 'Transferência realizada no cadastro do aluno', ?)
                        ");
                        $transfer->execute([$id, $previousClassId, $studentClassId, (int) $admin['id']]);
                    }
                }
            }
        }
        $pdo->commit();
        if ($id === (int) $admin['id']) {
            $_SESSION['user']['name'] = $name;
            $_SESSION['user']['email'] = $email;
            $_SESSION['user']['initials'] = initials($name);
            if ($password !== '') {
                $_SESSION['user']['mustChangePassword'] = false;
            }
            $admin = $_SESSION['user'];
        }
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'user', $id, ['role' => $role, 'status' => $status]);
    jsonResponse(['ok' => true, 'message' => 'Usuário salvo.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/user/delete') {
    requireMethod('DELETE', 'POST');
    $admin = currentUser();
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    if (!$id || $id === (int) $admin['id']) {
        jsonResponse(['ok' => false, 'message' => 'Usuário inválido.'], 422);
    }
    $target = $pdo->prepare('SELECT role FROM users WHERE id = ?');
    $target->execute([$id]);
    $targetRole = $target->fetchColumn();
    if (!$targetRole) {
        jsonResponse(['ok' => false, 'message' => 'Usuário não encontrado.'], 404);
    }
    $admin = requirePermission($pdo, $targetRole === 'student' ? 'students.manage' : 'teachers.manage');
    if ($admin['role'] !== 'admin' && in_array($targetRole, ['supervisor', 'admin', 'finance', 'administrative'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Somente o Admin Geral pode desativar gestores.'], 403);
    }
    $statement = $pdo->prepare("UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = ?");
    $statement->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'deactivate', 'user', $id, ['role' => $targetRole]);
    jsonResponse(['ok' => true, 'message' => 'Usuário desativado.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/user/permanent-delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id || $id === (int) $admin['id']) {
        jsonResponse(['ok' => false, 'message' => 'Aluno inválido.'], 422);
    }

    $target = $pdo->prepare("
        SELECT u.id, u.name, u.avatar_path
        FROM users u
        JOIN students s ON s.user_id = u.id
        WHERE u.id = ? AND u.role = 'student'
        LIMIT 1
    ");
    $target->execute([$id]);
    $student = $target->fetch();
    if (!$student) {
        jsonResponse(['ok' => false, 'message' => 'Aluno não encontrado.'], 404);
    }

    $files = $pdo->prepare("
        SELECT file.stored_name
        FROM submission_files file
        JOIN submissions submission ON submission.id = file.submission_id
        WHERE submission.student_id = ?
    ");
    $files->execute([$id]);
    $storedFiles = array_column($files->fetchAll(), 'stored_name');

    $pdo->beginTransaction();
    try {
        writeAuditLog($pdo, (int) $admin['id'], 'permanent_delete', 'student', $id, ['name' => $student['name']]);
        // Esta relação usa RESTRICT para preservar autores em exclusões comuns.
        // Na exclusão definitiva solicitada pela gestão, removemos também qualquer
        // observação excepcionalmente criada pela própria conta do aluno.
        $pdo->prepare('DELETE FROM pedagogical_notes WHERE author_user_id = ?')->execute([$id]);
        $delete = $pdo->prepare("DELETE FROM users WHERE id = ? AND role = 'student'");
        $delete->execute([$id]);
        if ($delete->rowCount() !== 1) {
            throw new RuntimeException('O aluno não pôde ser excluído.');
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }

    $uploadBase = rtrim((string) $config['uploads']['directory'], DIRECTORY_SEPARATOR);
    foreach ($storedFiles as $storedName) {
        $storedName = (string) $storedName;
        if ($storedName === '' || str_contains($storedName, '..')) continue;
        $candidate = $uploadBase . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, ltrim($storedName, '/\\'));
        if (is_file($candidate)) @unlink($candidate);
    }
    $avatarPath = (string) ($student['avatar_path'] ?? '');
    $avatarFile = resolveAvatarFilePath($avatarPath);
    if ($avatarFile !== null) @unlink($avatarFile);

    jsonResponse([
        'ok' => true,
        'message' => 'Aluno e histórico relacionado excluídos definitivamente.',
        'data' => $service->bootstrap($admin),
    ]);
}

if ($route === 'admin/reenrollment/contract/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'reenrollment.manage');
    requireCsrf();
    $data = requestData();
    $studentId = nullableInt($data['student_id'] ?? null);
    if (!$studentId) jsonResponse(['ok' => false, 'message' => 'Selecione um aluno.'], 422);
    $student = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'student' LIMIT 1");
    $student->execute([$studentId]);
    if (!$student->fetchColumn()) jsonResponse(['ok' => false, 'message' => 'Aluno não encontrado.'], 404);

    $signedAt = contractDateValue($data['contract_signed_at'] ?? null);
    $startDate = contractDateValue($data['contract_start_date'] ?? null);
    $endDate = contractDateValue($data['contract_end_date'] ?? null);
    $paymentCycleEnd = contractDateValue($data['payment_cycle_end_date'] ?? null);
    $enrollmentFeeNextDate = contractDateValue($data['enrollment_fee_next_date'] ?? null);
    $enrollmentFeeInput = $data['enrollment_fee_required'] ?? null;
    if ($enrollmentFeeInput === '' || $enrollmentFeeInput === null) {
        $enrollmentFeeRequired = null;
    } elseif (in_array($enrollmentFeeInput, [1, '1', true, 'true'], true)) {
        $enrollmentFeeRequired = 1;
    } elseif (in_array($enrollmentFeeInput, [0, '0', false, 'false'], true)) {
        $enrollmentFeeRequired = 0;
        $enrollmentFeeNextDate = null;
    } else {
        jsonResponse(['ok' => false, 'message' => 'Informe corretamente se existe taxa de matrícula.'], 422);
    }
    $durationMonths = nullableInt($data['duration_months'] ?? null);
    $paymentMethod = cleanString($data['payment_method'] ?? '', 30) ?: null;
    $billingAction = cleanString($data['billing_action'] ?? 'none', 30);
    $contractStatus = cleanString($data['contract_status'] ?? 'blank', 30);
    $renewalStatus = cleanString($data['renewal_status'] ?? 'not_started', 30);
    $notes = cleanString($data['notes'] ?? '', 5000);
    $allowedPaymentMethods = ['card', 'boleto', 'cash', 'scholarship', 'other'];
    $allowedBillingActions = ['none', 'issue_boleto', 'charge_card', 'send_card_link', 'renew_contract', 'contact_guardian'];
    $allowedStatuses = ['blank', 'active', 'pending', 'renewal_due', 'renewed', 'expired', 'rescinded', 'not_renewing'];
    $allowedRenewal = ['not_started', 'contacted', 'awaiting', 'confirmed', 'completed', 'declined'];
    if (($paymentMethod !== null && !in_array($paymentMethod, $allowedPaymentMethods, true))
        || !in_array($billingAction, $allowedBillingActions, true)
        || !in_array($contractStatus, $allowedStatuses, true)
        || !in_array($renewalStatus, $allowedRenewal, true)
        || ($durationMonths !== null && ($durationMonths < 1 || $durationMonths > 120))) {
        jsonResponse(['ok' => false, 'message' => 'Confira a duração, a forma de pagamento e as situações selecionadas.'], 422);
    }
    if ($startDate && $endDate && $endDate < $startDate) {
        jsonResponse(['ok' => false, 'message' => 'O término do contrato não pode ser anterior ao início.'], 422);
    }

    $feeColumnsStatement = $pdo->query("
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'student_contracts'
          AND COLUMN_NAME IN ('enrollment_fee_required', 'enrollment_fee_next_date')
    ");
    $hasEnrollmentFeeColumns = count($feeColumnsStatement->fetchAll(PDO::FETCH_COLUMN)) === 2;

    if ($hasEnrollmentFeeColumns) {
        $statement = $pdo->prepare("
            INSERT INTO student_contracts
                (student_id, contract_signed_at, contract_start_date, contract_end_date, duration_months,
                 payment_method, payment_cycle_end_date, enrollment_fee_required, enrollment_fee_next_date,
                 billing_action, contract_status, renewal_status, notes, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                contract_signed_at = VALUES(contract_signed_at), contract_start_date = VALUES(contract_start_date),
                contract_end_date = VALUES(contract_end_date), duration_months = VALUES(duration_months),
                payment_method = VALUES(payment_method), payment_cycle_end_date = VALUES(payment_cycle_end_date),
                enrollment_fee_required = VALUES(enrollment_fee_required),
                enrollment_fee_next_date = VALUES(enrollment_fee_next_date),
                billing_action = VALUES(billing_action), contract_status = VALUES(contract_status),
                renewal_status = VALUES(renewal_status), notes = VALUES(notes), updated_by = VALUES(updated_by),
                updated_at = NOW()
        ");
        $statement->execute([
            $studentId, $signedAt, $startDate, $endDate, $durationMonths, $paymentMethod,
            $paymentCycleEnd, $enrollmentFeeRequired, $enrollmentFeeNextDate,
            $billingAction, $contractStatus, $renewalStatus, $notes,
            (int) $admin['id'], (int) $admin['id'],
        ]);
    } else {
        $statement = $pdo->prepare("
            INSERT INTO student_contracts
                (student_id, contract_signed_at, contract_start_date, contract_end_date, duration_months,
                 payment_method, payment_cycle_end_date, billing_action, contract_status, renewal_status,
                 notes, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                contract_signed_at = VALUES(contract_signed_at), contract_start_date = VALUES(contract_start_date),
                contract_end_date = VALUES(contract_end_date), duration_months = VALUES(duration_months),
                payment_method = VALUES(payment_method), payment_cycle_end_date = VALUES(payment_cycle_end_date),
                billing_action = VALUES(billing_action), contract_status = VALUES(contract_status),
                renewal_status = VALUES(renewal_status), notes = VALUES(notes), updated_by = VALUES(updated_by),
                updated_at = NOW()
        ");
        $statement->execute([
            $studentId, $signedAt, $startDate, $endDate, $durationMonths, $paymentMethod,
            $paymentCycleEnd, $billingAction, $contractStatus, $renewalStatus, $notes,
            (int) $admin['id'], (int) $admin['id'],
        ]);
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'student_contract', $studentId, [
        'contract_status' => $contractStatus,
        'renewal_status' => $renewalStatus,
        'contract_end_date' => $endDate,
        'payment_method' => $paymentMethod,
        'enrollment_fee_required' => $enrollmentFeeRequired,
        'enrollment_fee_next_date' => $enrollmentFeeNextDate,
    ]);
    $saveMessage = $hasEnrollmentFeeColumns
        ? 'Dados do contrato salvos.'
        : 'Dados do contrato salvos. Os campos da taxa de matrícula aguardam a atualização do banco.';
    jsonResponse(['ok' => true, 'message' => $saveMessage, 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/reenrollment/followup/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'reenrollment.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $studentId = nullableInt($data['student_id'] ?? null);
    if (!$studentId) jsonResponse(['ok' => false, 'message' => 'Selecione um aluno.'], 422);
    $contactAt = contractDateValue($data['contact_at'] ?? null, true) ?: date('Y-m-d H:i:s');
    $channel = cleanString($data['channel'] ?? 'whatsapp', 30);
    $sentMessage = cleanString($data['sent_message'] ?? '', 5000);
    $guardianResponse = cleanString($data['guardian_response'] ?? '', 5000);
    $nextAction = cleanString($data['next_action'] ?? '', 5000);
    if (!in_array($channel, ['whatsapp', 'phone', 'email', 'in_person', 'other', 'legacy'], true)
        || ($sentMessage === '' && $guardianResponse === '' && $nextAction === '')) {
        jsonResponse(['ok' => false, 'message' => 'Informe a mensagem, a resposta ou a próxima ação do follow-up.'], 422);
    }
    $pdo->prepare("
        INSERT IGNORE INTO student_contracts (student_id, contract_status, renewal_status, created_by, updated_by)
        SELECT id, 'blank', 'not_started', ?, ? FROM users WHERE id = ? AND role = 'student'
    ")->execute([(int) $admin['id'], (int) $admin['id'], $studentId]);
    $contract = $pdo->prepare('SELECT id FROM student_contracts WHERE student_id = ? LIMIT 1');
    $contract->execute([$studentId]);
    $contractId = nullableInt($contract->fetchColumn());
    if (!$contractId) jsonResponse(['ok' => false, 'message' => 'Aluno não encontrado.'], 404);

    if ($id) {
        $statement = $pdo->prepare("
            UPDATE contract_followups
            SET contact_at = ?, channel = ?, sent_message = ?, guardian_response = ?, next_action = ?, updated_at = NOW()
            WHERE id = ? AND student_id = ?
        ");
        $statement->execute([$contactAt, $channel, $sentMessage ?: null, $guardianResponse ?: null, $nextAction ?: null, $id, $studentId]);
        if ($statement->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM contract_followups WHERE id = ? AND student_id = ?');
            $exists->execute([$id, $studentId]);
            if (!$exists->fetchColumn()) jsonResponse(['ok' => false, 'message' => 'Follow-up não encontrado.'], 404);
        }
    } else {
        $statement = $pdo->prepare("
            INSERT INTO contract_followups
                (contract_id, student_id, contact_at, channel, sent_message, guardian_response, next_action, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $statement->execute([$contractId, $studentId, $contactAt, $channel, $sentMessage ?: null, $guardianResponse ?: null, $nextAction ?: null, (int) $admin['id']]);
        $id = (int) $pdo->lastInsertId();
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'contract_followup', $id, ['student_id' => $studentId]);
    jsonResponse(['ok' => true, 'message' => 'Follow-up salvo no histórico.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/reenrollment/reminder/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'reenrollment.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $studentId = nullableInt($data['student_id'] ?? null);
    $title = requiredString($data, 'title', 160);
    $dueAt = contractDateValue($data['due_at'] ?? null, true);
    $type = cleanString($data['reminder_type'] ?? 'other', 30);
    $notes = cleanString($data['notes'] ?? '', 1000);
    $status = cleanString($data['status'] ?? 'pending', 20);
    $responsibleName = cleanString($data['responsible_name'] ?? '', 120);
    $installmentCount = nullableInt($data['installment_count'] ?? null);
    $firstDueDate = contractDateValue($data['first_due_date'] ?? null);
    $dueDay = nullableInt($data['due_day'] ?? null);
    $sponteRaw = $data['sponte_registered'] ?? '';
    $sponteRegistered = $sponteRaw === '' || $sponteRaw === null ? null : boolValue($sponteRaw);
    if (!$studentId || !$dueAt
        || !in_array($type, ['message', 'send_card_link', 'charge_card', 'issue_boleto', 'issue_enrollment_fee', 'renew_contract', 'other'], true)
        || !in_array($status, ['pending', 'cancelled', 'completed'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Confira o aluno, a data e o tipo do lembrete.'], 422);
    }
    if ($type === 'issue_boleto') {
        if ($responsibleName === '' || !$installmentCount || $installmentCount < 1 || $installmentCount > 36
            || !$firstDueDate || !$dueDay || $dueDay < 1 || $dueDay > 31 || $sponteRegistered === null) {
            jsonResponse(['ok' => false, 'message' => 'Informe o responsável, a quantidade de boletos, o primeiro vencimento, o dia de vencimento e a situação no Sponte.'], 422);
        }
        if (financialDateWithMonthOffset($firstDueDate, 0, $dueDay)->format('Y-m-d') !== $firstDueDate) {
            jsonResponse(['ok' => false, 'message' => 'O dia do primeiro vencimento precisa ser igual ao dia de vencimento informado.'], 422);
        }
    } else {
        $responsibleName = '';
        $installmentCount = null;
        $firstDueDate = null;
        $dueDay = null;
        $sponteRegistered = null;
    }
    $financialDeleteAfter = $type === 'issue_boleto'
        ? financialAttachmentRetentionDate($firstDueDate, $installmentCount, $dueDay)
        : null;
    $pdo->prepare("
        INSERT IGNORE INTO student_contracts (student_id, contract_status, renewal_status, created_by, updated_by)
        SELECT id, 'blank', 'not_started', ?, ? FROM users WHERE id = ? AND role = 'student'
    ")->execute([(int) $admin['id'], (int) $admin['id'], $studentId]);
    $contract = $pdo->prepare('SELECT id FROM student_contracts WHERE student_id = ? LIMIT 1');
    $contract->execute([$studentId]);
    $contractId = nullableInt($contract->fetchColumn());
    if (!$contractId) jsonResponse(['ok' => false, 'message' => 'Aluno não encontrado.'], 404);

    if ($id) {
        $statement = $pdo->prepare("
            UPDATE contract_reminders
            SET reminder_type = ?, title = ?, due_at = ?, notes = ?, status = ?,
                financial_responsible_name = ?, billing_installments = ?,
                billing_first_due_date = ?, billing_due_day = ?, sponte_registered = ?,
                attachment_delete_after = CASE
                    WHEN attachment_stored_name IS NOT NULL THEN COALESCE(?, attachment_delete_after)
                    ELSE attachment_delete_after
                END,
                updated_at = NOW()
            WHERE id = ? AND student_id = ?
        ");
        $statement->execute([
            $type, $title, $dueAt, $notes ?: null, $status,
            $responsibleName ?: null, $installmentCount, $firstDueDate, $dueDay,
            $sponteRegistered === null ? null : ($sponteRegistered ? 1 : 0),
            $financialDeleteAfter, $id, $studentId,
        ]);
        if ($statement->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM contract_reminders WHERE id = ? AND student_id = ?');
            $exists->execute([$id, $studentId]);
            if (!$exists->fetchColumn()) jsonResponse(['ok' => false, 'message' => 'Lembrete não encontrado.'], 404);
        }
    } else {
        $statement = $pdo->prepare("
            INSERT INTO contract_reminders
                (contract_id, student_id, reminder_type, title, due_at, notes, status,
                 financial_responsible_name, billing_installments, billing_first_due_date,
                 billing_due_day, sponte_registered, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $statement->execute([
            $contractId, $studentId, $type, $title, $dueAt, $notes ?: null, $status,
            $responsibleName ?: null, $installmentCount, $firstDueDate, $dueDay,
            $sponteRegistered === null ? null : ($sponteRegistered ? 1 : 0),
            (int) $admin['id'],
        ]);
        $id = (int) $pdo->lastInsertId();
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'contract_reminder', $id, ['student_id' => $studentId, 'due_at' => $dueAt]);
    jsonResponse(['ok' => true, 'message' => 'Lembrete salvo.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/reenrollment/reminder/complete') {
    requireMethod('POST', 'PUT');
    $actor = currentUser();
    $admin = requirePermission(
        $pdo,
        $actor['role'] === 'finance' ? 'reenrollment.financial' : 'reenrollment.manage'
    );
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $completed = boolValue($data['completed'] ?? true);
    if (!$id) jsonResponse(['ok' => false, 'message' => 'Lembrete inválido.'], 422);

    $reminderStatement = $pdo->prepare("
        SELECT id, reminder_type, status, billing_installments, billing_first_due_date,
               billing_due_day, attachment_original_name, attachment_stored_name,
               attachment_delete_after
        FROM contract_reminders
        WHERE id = ?
        LIMIT 1
    ");
    $reminderStatement->execute([$id]);
    $reminder = $reminderStatement->fetch();
    if (!$reminder) jsonResponse(['ok' => false, 'message' => 'Lembrete não encontrado.'], 404);

    if ($admin['role'] === 'finance') {
        if (!in_array($reminder['reminder_type'], ['issue_boleto', 'issue_enrollment_fee'], true)) {
            jsonResponse(['ok' => false, 'message' => 'O Financeiro só pode concluir tarefas de carnê, boleto ou taxa de matrícula.'], 403);
        }
    }

    $newAbsolutePath = null;
    $newRelativePath = null;
    $newOriginalName = null;
    $newMime = null;
    $newSize = null;
    $deleteAfter = $reminder['attachment_delete_after'];
    $file = $_FILES['boleto_pdf'] ?? null;
    $hasNewFile = is_array($file) && ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;

    if ($completed && $reminder['reminder_type'] === 'issue_boleto') {
        $installments = nullableInt($reminder['billing_installments'] ?? null);
        $firstDueDate = contractDateValue($reminder['billing_first_due_date'] ?? null);
        $dueDay = nullableInt($reminder['billing_due_day'] ?? null);
        if (!$installments || !$firstDueDate || !$dueDay) {
            jsonResponse(['ok' => false, 'message' => 'Edite a tarefa e informe o período e os vencimentos antes de concluí-la.'], 422);
        }
        $deleteAfter = financialAttachmentRetentionDate($firstDueDate, $installments, $dueDay);

        if ($hasNewFile) {
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                jsonResponse(['ok' => false, 'message' => 'Não foi possível receber o PDF do carnê.'], 422);
            }
            $newSize = (int) ($file['size'] ?? 0);
            $temporaryPath = (string) ($file['tmp_name'] ?? '');
            $newOriginalName = mb_substr(basename((string) ($file['name'] ?? 'carne-boletos.pdf')), 0, 255, 'UTF-8');
            $extension = strtolower(pathinfo($newOriginalName, PATHINFO_EXTENSION));
            $newMime = is_file($temporaryPath) ? ((new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath) ?: '') : '';
            $pdfSignature = is_file($temporaryPath) ? (string) file_get_contents($temporaryPath, false, null, 0, 5) : '';
            if ($newSize <= 0 || $newSize > (int) $config['uploads']['max_file_size']
                || $extension !== 'pdf' || $pdfSignature !== '%PDF-'
                || !in_array($newMime, ['application/pdf', 'application/x-pdf', 'application/octet-stream'], true)) {
                jsonResponse(['ok' => false, 'message' => 'Envie um arquivo PDF válido de até 5 MB.'], 422);
            }
            $newMime = 'application/pdf';
            $relativeDirectory = 'financial' . DIRECTORY_SEPARATOR . date('Y') . DIRECTORY_SEPARATOR . date('m');
            $targetDirectory = $config['uploads']['directory'] . DIRECTORY_SEPARATOR . $relativeDirectory;
            if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0750, true) && !is_dir($targetDirectory)) {
                throw new RuntimeException('Não foi possível criar a pasta protegida dos carnês.');
            }
            $storedFileName = bin2hex(random_bytes(20)) . '.pdf';
            $newRelativePath = $relativeDirectory . DIRECTORY_SEPARATOR . $storedFileName;
            $newAbsolutePath = $config['uploads']['directory'] . DIRECTORY_SEPARATOR . $newRelativePath;
            if (!move_uploaded_file($temporaryPath, $newAbsolutePath)) {
                throw new RuntimeException('Não foi possível salvar o PDF do carnê.');
            }
        } elseif (empty($reminder['attachment_stored_name'])) {
            jsonResponse(['ok' => false, 'message' => 'Anexe o PDF do carnê antes de marcar a tarefa como concluída.'], 422);
        }
    } elseif ($hasNewFile) {
        jsonResponse(['ok' => false, 'message' => 'O PDF só pode ser anexado a uma tarefa de emissão de carnê ou boleto.'], 422);
    }

    try {
        if ($newRelativePath !== null) {
            $statement = $pdo->prepare("
                UPDATE contract_reminders
                SET status = ?, completed_at = ?, completed_by = ?,
                    attachment_original_name = ?, attachment_stored_name = ?,
                    attachment_mime_type = ?, attachment_file_size = ?,
                    attachment_uploaded_at = NOW(), attachment_delete_after = ?,
                    attachment_deleted_at = NULL, updated_at = NOW()
                WHERE id = ?
            ");
            $statement->execute([
                $completed ? 'completed' : 'pending', $completed ? date('Y-m-d H:i:s') : null,
                $completed ? (int) $admin['id'] : null, $newOriginalName, $newRelativePath,
                $newMime, $newSize, $deleteAfter, $id,
            ]);
        } else {
            $statement = $pdo->prepare("
                UPDATE contract_reminders
                SET status = ?, completed_at = ?, completed_by = ?,
                    attachment_delete_after = COALESCE(?, attachment_delete_after), updated_at = NOW()
                WHERE id = ?
            ");
            $statement->execute([
                $completed ? 'completed' : 'pending', $completed ? date('Y-m-d H:i:s') : null,
                $completed ? (int) $admin['id'] : null, $completed ? $deleteAfter : null, $id,
            ]);
        }
    } catch (Throwable $exception) {
        if ($newAbsolutePath && is_file($newAbsolutePath)) @unlink($newAbsolutePath);
        throw $exception;
    }

    if ($newRelativePath !== null && !empty($reminder['attachment_stored_name'])) {
        $oldFile = resolveFinancialAttachmentPath((string) $reminder['attachment_stored_name'], $config['uploads']['directory']);
        if ($oldFile) @unlink($oldFile);
    }
    writeAuditLog($pdo, (int) $admin['id'], $completed ? 'complete' : 'reopen', 'contract_reminder', $id, [
        'pdf_uploaded' => $newRelativePath !== null,
        'pdf_delete_after' => $deleteAfter,
    ]);
    jsonResponse([
        'ok' => true,
        'message' => $completed
            ? ($reminder['reminder_type'] === 'issue_boleto' ? 'Carnê salvo e tarefa concluída.' : 'Lembrete concluído.')
            : 'Lembrete reaberto.',
        'data' => $service->bootstrap($admin),
    ]);
}

if ($route === 'admin/reenrollment/reminder/file') {
    requireMethod('GET');
    $actor = currentUser();
    $viewer = requirePermission(
        $pdo,
        $actor['role'] === 'finance' ? 'reenrollment.financial' : 'reenrollment.manage'
    );
    $id = nullableInt($_GET['id'] ?? null);
    if (!$id) {
        http_response_code(404);
        exit;
    }
    $statement = $pdo->prepare("
        SELECT reminder_type, attachment_original_name, attachment_stored_name,
               attachment_mime_type, attachment_file_size, attachment_delete_after
        FROM contract_reminders
        WHERE id = ?
        LIMIT 1
    ");
    $statement->execute([$id]);
    $attachment = $statement->fetch();
    if (!$attachment || ($viewer['role'] === 'finance'
        && !in_array($attachment['reminder_type'], ['issue_boleto', 'issue_enrollment_fee'], true))) {
        http_response_code(404);
        exit;
    }
    if (!empty($attachment['attachment_delete_after'])
        && $attachment['attachment_delete_after'] <= date('Y-m-d')) {
        $expiredFile = resolveFinancialAttachmentPath((string) ($attachment['attachment_stored_name'] ?? ''), $config['uploads']['directory']);
        if ($expiredFile) @unlink($expiredFile);
        $pdo->prepare("
            UPDATE contract_reminders
            SET attachment_original_name = NULL, attachment_stored_name = NULL,
                attachment_mime_type = NULL, attachment_file_size = NULL,
                attachment_uploaded_at = NULL, attachment_deleted_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ")->execute([$id]);
        http_response_code(404);
        exit;
    }
    $absolutePath = resolveFinancialAttachmentPath((string) ($attachment['attachment_stored_name'] ?? ''), $config['uploads']['directory']);
    if (!$absolutePath) {
        http_response_code(404);
        exit;
    }
    $downloadName = (string) ($attachment['attachment_original_name'] ?: 'carne-boletos.pdf');
    header('Content-Type: application/pdf');
    header('Content-Length: ' . (string) filesize($absolutePath));
    header("Content-Disposition: inline; filename*=UTF-8''" . rawurlencode($downloadName));
    header('Cache-Control: private, no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    readfile($absolutePath);
    exit;
}

if ($route === 'admin/reenrollment/rescind') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'reenrollment.manage');
    requireCsrf();
    $data = requestData();
    $studentId = nullableInt($data['student_id'] ?? null);
    $rescindedAt = contractDateValue($data['rescinded_at'] ?? null);
    $reason = requiredString($data, 'reason', 1000);
    if (!$studentId || !$rescindedAt) jsonResponse(['ok' => false, 'message' => 'Informe o aluno e a data da rescisão.'], 422);

    $pdo->beginTransaction();
    try {
        $pdo->prepare("
            INSERT INTO student_contracts
                (student_id, contract_status, renewal_status, billing_action, rescinded_at, rescission_reason, created_by, updated_by)
            SELECT id, 'rescinded', 'declined', 'none', ?, ?, ?, ? FROM users WHERE id = ? AND role = 'student'
            ON DUPLICATE KEY UPDATE contract_status = 'rescinded', renewal_status = 'declined',
                billing_action = 'none', rescinded_at = VALUES(rescinded_at),
                rescission_reason = VALUES(rescission_reason), updated_by = VALUES(updated_by), updated_at = NOW()
        ")->execute([$rescindedAt, $reason, (int) $admin['id'], (int) $admin['id'], $studentId]);
        $contract = $pdo->prepare('SELECT id FROM student_contracts WHERE student_id = ? LIMIT 1');
        $contract->execute([$studentId]);
        $contractId = nullableInt($contract->fetchColumn());
        if (!$contractId) throw new RuntimeException('Aluno não encontrado.');
        $pdo->prepare("
            UPDATE contract_reminders
            SET status = 'cancelled', updated_at = NOW()
            WHERE contract_id = ? AND status = 'pending'
        ")->execute([$contractId]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    writeAuditLog($pdo, (int) $admin['id'], 'rescind', 'student_contract', $studentId, ['rescinded_at' => $rescindedAt, 'reason' => $reason]);
    jsonResponse(['ok' => true, 'message' => 'Rescisão registrada e lembretes pendentes cancelados.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/store-product/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'store.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $name = requiredString($data, 'name', 120);
    $description = requiredString($data, 'description', 500);
    $category = requiredString($data, 'category', 60);
    $price = nullableInt($data['price_joys'] ?? null);
    $inventoryMode = cleanString($data['inventory_mode'] ?? 'limited', 20);
    $stock = nullableInt($data['stock_quantity'] ?? null);
    $status = cleanString($data['status'] ?? 'active', 20);
    $sortOrder = nullableInt($data['sort_order'] ?? 1) ?? 1;
    if (!$price || $price < 1 || $price > 1000000
        || !in_array($inventoryMode, ['limited', 'unlimited'], true)
        || !in_array($status, ['active', 'inactive'], true)
        || ($inventoryMode === 'limited' && ($stock === null || $stock < 0 || $stock > 100000))) {
        jsonResponse(['ok' => false, 'message' => 'Confira o valor, o tipo de estoque e a quantidade do produto.'], 422);
    }
    if ($inventoryMode === 'unlimited') $stock = null;

    $existingImage = null;
    if ($id) {
        $existing = $pdo->prepare('SELECT image_path FROM store_products WHERE id = ?');
        $existing->execute([$id]);
        $existingImage = $existing->fetchColumn();
        if ($existingImage === false) jsonResponse(['ok' => false, 'message' => 'Produto não encontrado.'], 404);
    }

    $imagePath = $existingImage ?: null;
    $newImageFile = null;
    if (!empty($_FILES['image']) && is_array($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $file = $_FILES['image'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            jsonResponse(['ok' => false, 'message' => 'Não foi possível receber a imagem do produto.'], 422);
        }
        $size = (int) ($file['size'] ?? 0);
        $temporaryPath = (string) ($file['tmp_name'] ?? '');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath) ?: '';
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if ($size <= 0 || $size > (int) $config['uploads']['max_image_size'] || !isset($allowed[$mime]) || @getimagesize($temporaryPath) === false) {
            jsonResponse(['ok' => false, 'message' => 'Use uma imagem JPG, PNG ou WebP de até 1,5 MB.'], 422);
        }
        $relativeDirectory = 'images/store/custom/' . date('Y') . '/' . date('m');
        $targetDirectory = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeDirectory);
        if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0755, true) && !is_dir($targetDirectory)) {
            throw new RuntimeException('Não foi possível criar a pasta de imagens da loja.');
        }
        $fileName = bin2hex(random_bytes(20)) . '.' . $allowed[$mime];
        $newImageFile = $targetDirectory . DIRECTORY_SEPARATOR . $fileName;
        if (!move_uploaded_file($temporaryPath, $newImageFile)) {
            throw new RuntimeException('Não foi possível salvar a imagem do produto.');
        }
        $imagePath = '/' . $relativeDirectory . '/' . $fileName;
    }
    if (!$id && !$imagePath) {
        jsonResponse(['ok' => false, 'message' => 'Escolha uma imagem para o novo produto.'], 422);
    }

    try {
        if ($id) {
            $statement = $pdo->prepare("
                UPDATE store_products
                SET name = ?, description = ?, category = ?, price_joys = ?, image_path = ?,
                    inventory_mode = ?, stock_quantity = ?, status = ?, sort_order = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $statement->execute([$name, $description, $category, $price, $imagePath, $inventoryMode, $stock, $status, max(1, $sortOrder), $id]);
        } else {
            $statement = $pdo->prepare("
                INSERT INTO store_products
                    (name, description, category, price_joys, image_path, inventory_mode, stock_quantity, status, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $statement->execute([$name, $description, $category, $price, $imagePath, $inventoryMode, $stock, $status, max(1, $sortOrder)]);
            $id = (int) $pdo->lastInsertId();
        }
    } catch (Throwable $exception) {
        if ($newImageFile && is_file($newImageFile)) @unlink($newImageFile);
        throw $exception;
    }
    if ($newImageFile && is_string($existingImage) && str_starts_with($existingImage, '/images/store/custom/') && !str_contains($existingImage, '..')) {
        $oldImageFile = dirname(__DIR__) . str_replace('/', DIRECTORY_SEPARATOR, $existingImage);
        if (is_file($oldImageFile)) @unlink($oldImageFile);
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'store_product', $id, [
        'price_joys' => $price,
        'inventory_mode' => $inventoryMode,
        'stock_quantity' => $stock,
        'status' => $status,
    ]);
    jsonResponse(['ok' => true, 'message' => 'Produto salvo na CreateStore.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/permission/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'permissions.manage');
    requireCsrf();
    $data = requestData();
    $roleCode = cleanString($data['role_code'] ?? '', 30);
    $permissionCode = cleanString($data['permission_code'] ?? '', 80);
    $allowed = boolValue($data['allowed'] ?? false);

    if ($roleCode === '' || $permissionCode === '' || $roleCode === 'admin') {
        jsonResponse(['ok' => false, 'message' => 'Permissão inválida ou protegida.'], 422);
    }

    $exists = $pdo->prepare("
        SELECT
            EXISTS(SELECT 1 FROM roles WHERE code = ?) AS role_exists,
            EXISTS(SELECT 1 FROM permissions WHERE code = ?) AS permission_exists
    ");
    $exists->execute([$roleCode, $permissionCode]);
    $valid = $exists->fetch();
    if (!$valid || !(bool) $valid['role_exists'] || !(bool) $valid['permission_exists']) {
        jsonResponse(['ok' => false, 'message' => 'Perfil ou permissão não encontrado.'], 404);
    }

    if ($allowed) {
        $statement = $pdo->prepare('INSERT IGNORE INTO role_permissions (role_code, permission_code) VALUES (?, ?)');
        $statement->execute([$roleCode, $permissionCode]);
    } else {
        $statement = $pdo->prepare('DELETE FROM role_permissions WHERE role_code = ? AND permission_code = ?');
        $statement->execute([$roleCode, $permissionCode]);
    }
    writeAuditLog($pdo, (int) $admin['id'], $allowed ? 'grant' : 'revoke', 'role_permission', $roleCode . ':' . $permissionCode);

    jsonResponse(['ok' => true, 'message' => 'Permissão atualizada.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/module/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'curriculum.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $name = requiredString($data, 'name', 100);
    $level = nullableInt($data['level'] ?? null);
    $description = cleanString($data['description'] ?? '', 500);
    $workload = nullableInt($data['workload_hours'] ?? 0) ?? 0;
    $status = cleanString($data['status'] ?? 'active', 20);
    $color = cleanString($data['color'] ?? '#1E72B8', 7);
    if (!$level || $level < 1 || $workload < 0
        || !in_array($status, ['active', 'inactive'], true)
        || !preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
        jsonResponse(['ok' => false, 'message' => 'Dados do módulo inválidos.'], 422);
    }

    if ($id) {
        $statement = $pdo->prepare("
            UPDATE modules
            SET name = ?, level = ?, description = ?, workload_hours = ?, status = ?, color = ?
            WHERE id = ?
        ");
        $statement->execute([$name, $level, $description, $workload, $status, $color, $id]);
    } else {
        $statement = $pdo->prepare("
            INSERT INTO modules (name, level, description, workload_hours, status, color)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $statement->execute([$name, $level, $description, $workload, $status, $color]);
        $id = (int) $pdo->lastInsertId();
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'module', $id, ['name' => $name, 'status' => $status]);
    jsonResponse(['ok' => true, 'message' => 'Módulo salvo.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/module/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'curriculum.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    if (!$id) {
        jsonResponse(['ok' => false, 'message' => 'Módulo inválido.'], 422);
    }
    $used = $pdo->prepare('SELECT COUNT(*) FROM missions WHERE module_id = ?');
    $used->execute([$id]);
    if ((int) $used->fetchColumn() > 0) {
        jsonResponse(['ok' => false, 'message' => 'Arquive o módulo: ele possui missões vinculadas.'], 409);
    }
    $statement = $pdo->prepare('DELETE FROM modules WHERE id = ?');
    $statement->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'delete', 'module', $id);
    jsonResponse(['ok' => true, 'message' => 'Módulo excluído.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/mission/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'missions.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $moduleId = nullableInt($data['module_id'] ?? null);
    $title = requiredString($data, 'title', 160);
    $objective = cleanString($data['objective'] ?? '', 500);
    $description = requiredString($data, 'description', 20000);
    $lesson = nullableInt($data['lesson_number'] ?? 1) ?? 1;
    $order = nullableInt($data['sort_order'] ?? $lesson) ?? $lesson;
    $type = cleanString($data['type'] ?? 'required', 20);
    $status = cleanString($data['status'] ?? 'active', 20);
    $delivery = cleanString($data['delivery_type'] ?? 'codigo', 20);
    $joysReward = nullableInt($data['joys_reward'] ?? 0) ?? 0;
    $extraPrerequisiteId = nullableInt($data['extra_prerequisite_id'] ?? null);
    $previousType = null;
    if ($id) {
        $previousTypeStatement = $pdo->prepare('SELECT type FROM missions WHERE id = ?');
        $previousTypeStatement->execute([$id]);
        $previousType = $previousTypeStatement->fetchColumn() ?: null;
    }
    $steps = $data['steps'] ?? [];
    if (is_string($steps)) {
        $steps = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $steps) ?: [])));
    }
    if (!$moduleId || $joysReward < 0 || $joysReward > 10000
        || !in_array($type, ['required', 'extra'], true)
        || !in_array($status, ['active', 'draft', 'archived'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Dados da missão inválidos.'], 422);
    }
    if ($type === 'extra') {
        if (!$extraPrerequisiteId || $extraPrerequisiteId === $id) {
            jsonResponse(['ok' => false, 'message' => 'Selecione a missão obrigatória que libera esta missão extra.'], 422);
        }
        $prerequisiteCheck = $pdo->prepare("SELECT id FROM missions WHERE id = ? AND module_id = ? AND type = 'required'");
        $prerequisiteCheck->execute([$extraPrerequisiteId, $moduleId]);
        if (!$prerequisiteCheck->fetchColumn()) {
            jsonResponse(['ok' => false, 'message' => 'A missão que libera o extra deve ser obrigatória e pertencer ao mesmo módulo.'], 422);
        }
    }
    $stepsJson = json_encode($steps, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $pdo->beginTransaction();
    try {
        if ($id) {
            $statement = $pdo->prepare("
                UPDATE missions
                SET module_id = ?, title = ?, objective = ?, description = ?,
                    lesson_number = ?, sort_order = ?, type = ?, status = ?,
                    delivery_type = ?, steps_json = ?, joys_reward = ?
                WHERE id = ?
            ");
            $statement->execute([
                $moduleId, $title, $objective, $description, $lesson, $order,
                $type, $status, $delivery, $stepsJson, $joysReward, $id,
            ]);
        } else {
            $statement = $pdo->prepare("
                INSERT INTO missions
                    (module_id, title, objective, description, lesson_number, sort_order,
                     type, status, delivery_type, steps_json, joys_reward, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $statement->execute([
                $moduleId, $title, $objective, $description, $lesson, $order,
                $type, $status, $delivery, $stepsJson, $joysReward, (int) $admin['id'],
            ]);
            $id = (int) $pdo->lastInsertId();
        }

        $pdo->prepare('DELETE FROM mission_steps WHERE mission_id = ?')->execute([$id]);
        if ($steps) {
            $insertStep = $pdo->prepare('INSERT INTO mission_steps (mission_id, step_order, instruction) VALUES (?, ?, ?)');
            foreach (array_values($steps) as $index => $instruction) {
                $cleanInstruction = cleanString($instruction, 5000);
                if ($cleanInstruction !== '') {
                    $insertStep->execute([$id, $index + 1, $cleanInstruction]);
                }
            }
        }
        if ($type === 'extra') {
            $pdo->prepare('DELETE FROM mission_prerequisites WHERE mission_id = ?')->execute([$id]);
            $pdo->prepare('INSERT INTO mission_prerequisites (mission_id, prerequisite_mission_id) VALUES (?, ?)')
                ->execute([$id, $extraPrerequisiteId]);
        } elseif ($previousType === 'extra') {
            $pdo->prepare('DELETE FROM mission_prerequisites WHERE mission_id = ?')->execute([$id]);
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'mission', $id, ['title' => $title, 'status' => $status]);
    jsonResponse(['ok' => true, 'message' => 'Missão salva.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/mission/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'missions.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    if (!$id) {
        jsonResponse(['ok' => false, 'message' => 'Missão inválida.'], 422);
    }
    $used = $pdo->prepare('SELECT COUNT(*) FROM submissions WHERE mission_id = ?');
    $used->execute([$id]);
    if ((int) $used->fetchColumn() > 0) {
        $statement = $pdo->prepare("UPDATE missions SET status = 'archived' WHERE id = ?");
        $statement->execute([$id]);
        writeAuditLog($pdo, (int) $admin['id'], 'archive', 'mission', $id);
        jsonResponse(['ok' => true, 'message' => 'Missão arquivada porque já possui entregas.', 'data' => $service->bootstrap($admin)]);
    }
    $statement = $pdo->prepare('DELETE FROM missions WHERE id = ?');
    $statement->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'delete', 'mission', $id);
    jsonResponse(['ok' => true, 'message' => 'Missão excluída.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/class/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'classes.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $name = requiredString($data, 'name', 120);
    $teacherId = nullableInt($data['teacher_user_id'] ?? null);
    $semesterId = nullableInt($data['semester_id'] ?? null);
    $schedule = cleanString($data['schedule'] ?? '', 190);
    $status = cleanString($data['status'] ?? 'active', 20);
    $moduleIds = $data['module_ids'] ?? [];
    if (is_string($moduleIds)) {
        $moduleIds = array_filter(array_map('intval', explode(',', $moduleIds)));
    }
    $moduleIds = array_values(array_unique(array_map('intval', is_array($moduleIds) ? $moduleIds : [])));
    if (!in_array($status, ['active', 'inactive'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Status da turma inválido.'], 422);
    }
    if ($teacherId) {
        $teacherCheck = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'teacher'");
        $teacherCheck->execute([$teacherId]);
        if (!$teacherCheck->fetch()) {
            jsonResponse(['ok' => false, 'message' => 'Professor inválido.'], 422);
        }
    }
    if ($semesterId) {
        $semesterCheck = $pdo->prepare('SELECT id FROM semesters WHERE id = ?');
        $semesterCheck->execute([$semesterId]);
        if (!$semesterCheck->fetch()) {
            jsonResponse(['ok' => false, 'message' => 'Semestre inválido.'], 422);
        }
    }

    $pdo->beginTransaction();
    try {
        if ($id) {
            $statement = $pdo->prepare('UPDATE classes SET name = ?, teacher_user_id = ?, semester_id = ?, schedule = ?, status = ? WHERE id = ?');
            $statement->execute([$name, $teacherId, $semesterId, $schedule, $status, $id]);
        } else {
            $statement = $pdo->prepare('INSERT INTO classes (name, teacher_user_id, semester_id, schedule, status) VALUES (?, ?, ?, ?, ?)');
            $statement->execute([$name, $teacherId, $semesterId, $schedule, $status]);
            $id = (int) $pdo->lastInsertId();
        }
        $pdo->prepare('DELETE FROM class_modules WHERE class_id = ?')->execute([$id]);
        $insert = $pdo->prepare('INSERT INTO class_modules (class_id, module_id) VALUES (?, ?)');
        foreach ($moduleIds as $moduleId) {
            if ($moduleId > 0) {
                $insert->execute([$id, $moduleId]);
            }
        }
        $pdo->commit();
        writeAuditLog($pdo, (int) $admin['id'], 'save', 'class', $id, ['name' => $name, 'status' => $status]);
        jsonResponse(['ok' => true, 'message' => 'Turma salva.', 'data' => $service->bootstrap($admin)]);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

if ($route === 'admin/class/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'classes.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    if (!$id) {
        jsonResponse(['ok' => false, 'message' => 'Turma inválida.'], 422);
    }
    $used = $pdo->prepare('SELECT COUNT(*) FROM students WHERE class_id = ?');
    $used->execute([$id]);
    if ((int) $used->fetchColumn() > 0) {
        $statement = $pdo->prepare("UPDATE classes SET status = 'inactive' WHERE id = ?");
        $statement->execute([$id]);
        writeAuditLog($pdo, (int) $admin['id'], 'deactivate', 'class', $id);
        jsonResponse(['ok' => true, 'message' => 'Turma desativada porque possui alunos.', 'data' => $service->bootstrap($admin)]);
    }
    $statement = $pdo->prepare('DELETE FROM classes WHERE id = ?');
    $statement->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'delete', 'class', $id);
    jsonResponse(['ok' => true, 'message' => 'Turma excluída.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/activity/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'activities.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $missionId = nullableInt($data['mission_id'] ?? null);
    $name = requiredString($data, 'name', 160);
    $type = cleanString($data['type'] ?? 'exercicio', 20);
    $delivery = cleanString($data['delivery_type'] ?? 'texto', 20);
    $criteria = cleanString($data['criteria'] ?? '', 500);
    $prerequisiteActivityId = nullableInt($data['prerequisite_activity_id'] ?? null);
    $previousType = null;
    if ($id) {
        $previousTypeStatement = $pdo->prepare('SELECT type FROM activities WHERE id = ?');
        $previousTypeStatement->execute([$id]);
        $previousType = $previousTypeStatement->fetchColumn() ?: null;
    }
    if (!$missionId || !in_array($type, ['exercicio', 'desafio', 'arquivo'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Dados da atividade inválidos.'], 422);
    }
    if ($type === 'desafio') {
        if (!$prerequisiteActivityId || $prerequisiteActivityId === $id) {
            jsonResponse(['ok' => false, 'message' => 'Selecione a atividade obrigatória que libera este desafio extra.'], 422);
        }
        $prerequisiteCheck = $pdo->prepare("SELECT id FROM activities WHERE id = ? AND mission_id = ? AND type IN ('exercicio', 'exercise')");
        $prerequisiteCheck->execute([$prerequisiteActivityId, $missionId]);
        if (!$prerequisiteCheck->fetchColumn()) {
            jsonResponse(['ok' => false, 'message' => 'A atividade que libera o desafio deve ser obrigatória e pertencer à mesma missão.'], 422);
        }
    }

    $pdo->beginTransaction();
    try {
        if ($id) {
            $statement = $pdo->prepare('UPDATE activities SET mission_id = ?, name = ?, type = ?, delivery_type = ?, criteria = ? WHERE id = ?');
            $statement->execute([$missionId, $name, $type, $delivery, $criteria, $id]);
        } else {
            $statement = $pdo->prepare('INSERT INTO activities (mission_id, name, type, delivery_type, criteria) VALUES (?, ?, ?, ?, ?)');
            $statement->execute([$missionId, $name, $type, $delivery, $criteria]);
            $id = (int) $pdo->lastInsertId();
        }
        if ($type === 'desafio') {
            $pdo->prepare('DELETE FROM activity_prerequisites WHERE activity_id = ?')->execute([$id]);
            $pdo->prepare('INSERT INTO activity_prerequisites (activity_id, prerequisite_activity_id) VALUES (?, ?)')
                ->execute([$id, $prerequisiteActivityId]);
        } elseif ($previousType === 'desafio') {
            $pdo->prepare('DELETE FROM activity_prerequisites WHERE activity_id = ?')->execute([$id]);
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'activity', $id, ['name' => $name, 'mission_id' => $missionId]);
    jsonResponse(['ok' => true, 'message' => 'Atividade salva.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/activity/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'activities.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    if (!$id) {
        jsonResponse(['ok' => false, 'message' => 'Atividade inválida.'], 422);
    }
    $pdo->prepare('DELETE FROM activities WHERE id = ?')->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'delete', 'activity', $id);
    jsonResponse(['ok' => true, 'message' => 'Atividade excluída.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/semester/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'curriculum.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $name = requiredString($data, 'name', 100);
    $startDate = cleanString($data['start_date'] ?? '', 10);
    $endDate = cleanString($data['end_date'] ?? '', 10);
    $status = cleanString($data['status'] ?? 'planned', 20);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)
        || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)
        || $startDate > $endDate
        || !in_array($status, ['planned', 'active', 'closed', 'archived'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Período ou status do semestre inválido.'], 422);
    }
    if ($id) {
        $statement = $pdo->prepare('UPDATE semesters SET name = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?');
        $statement->execute([$name, $startDate, $endDate, $status, $id]);
    } else {
        $statement = $pdo->prepare('INSERT INTO semesters (name, start_date, end_date, status) VALUES (?, ?, ?, ?)');
        $statement->execute([$name, $startDate, $endDate, $status]);
        $id = (int) $pdo->lastInsertId();
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'semester', $id, ['name' => $name, 'status' => $status]);
    jsonResponse(['ok' => true, 'message' => 'Semestre salvo.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/semester/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'curriculum.manage');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id) jsonResponse(['ok' => false, 'message' => 'Semestre inválido.'], 422);
    $pdo->prepare("UPDATE semesters SET status = 'archived' WHERE id = ?")->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'archive', 'semester', $id);
    jsonResponse(['ok' => true, 'message' => 'Semestre arquivado.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/medal/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'curriculum.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $name = requiredString($data, 'name', 100);
    $description = cleanString($data['description'] ?? '', 255);
    $icon = cleanString($data['icon'] ?? '🏅', 30);
    $criteriaType = cleanString($data['criteria_type'] ?? 'manual', 50);
    $criteriaValue = nullableInt($data['criteria_value'] ?? null);
    $joysReward = nullableInt($data['joys_reward'] ?? 0) ?? 0;
    $status = cleanString($data['status'] ?? 'active', 20);
    $criteriaTypes = ['manual', 'first_submission', 'stl_upload', 'approved_count', 'module_complete', 'progress_percent'];
    if (!in_array($criteriaType, $criteriaTypes, true) || $joysReward < 0 || $joysReward > 10000
        || !in_array($status, ['active', 'inactive'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Dados da medalha inválidos.'], 422);
    }
    if ($id) {
        $statement = $pdo->prepare('UPDATE medals SET name = ?, description = ?, icon = ?, criteria_type = ?, criteria_value = ?, joys_reward = ?, status = ? WHERE id = ?');
        $statement->execute([$name, $description, $icon, $criteriaType, $criteriaValue, $joysReward, $status, $id]);
    } else {
        $statement = $pdo->prepare('INSERT INTO medals (name, description, icon, criteria_type, criteria_value, joys_reward, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([$name, $description, $icon, $criteriaType, $criteriaValue, $joysReward, $status]);
        $id = (int) $pdo->lastInsertId();
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'medal', $id, ['name' => $name, 'status' => $status]);
    jsonResponse(['ok' => true, 'message' => 'Medalha salva.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/medal/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'curriculum.manage');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id) jsonResponse(['ok' => false, 'message' => 'Medalha inválida.'], 422);
    $pdo->prepare("UPDATE medals SET status = 'inactive' WHERE id = ?")->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'deactivate', 'medal', $id);
    jsonResponse(['ok' => true, 'message' => 'Medalha desativada.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/lab-kit/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $code = cleanString($data['code'] ?? '', 50);
    $name = requiredString($data, 'name', 120);
    $description = cleanString($data['description'] ?? '', 500);
    $status = cleanString($data['status'] ?? 'active', 20);
    $items = $data['items'] ?? [];
    if (is_string($items)) {
        $items = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $items) ?: [])));
    }
    if (!is_array($items) || !in_array($status, ['active', 'inactive'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Dados do kit inválidos.'], 422);
    }
    $pdo->beginTransaction();
    try {
        if ($id) {
            $pdo->prepare('UPDATE lab_kits SET code = ?, name = ?, description = ?, status = ? WHERE id = ?')
                ->execute([$code ?: null, $name, $description, $status, $id]);
        } else {
            $pdo->prepare('INSERT INTO lab_kits (code, name, description, status) VALUES (?, ?, ?, ?)')
                ->execute([$code ?: null, $name, $description, $status]);
            $id = (int) $pdo->lastInsertId();
        }
        $pdo->prepare('DELETE FROM lab_kit_items WHERE kit_id = ?')->execute([$id]);
        $insertItem = $pdo->prepare('INSERT INTO lab_kit_items (kit_id, name, quantity, notes) VALUES (?, ?, ?, ?)');
        foreach ($items as $item) {
            if (is_array($item)) {
                $itemName = cleanString($item['name'] ?? '', 120);
                $quantity = max(1, nullableInt($item['quantity'] ?? 1) ?? 1);
                $notes = cleanString($item['notes'] ?? '', 255);
            } else {
                $parts = array_map('trim', explode('|', (string) $item, 3));
                $itemName = cleanString($parts[0] ?? '', 120);
                $quantity = max(1, nullableInt($parts[1] ?? 1) ?? 1);
                $notes = cleanString($parts[2] ?? '', 255);
            }
            if ($itemName !== '') $insertItem->execute([$id, $itemName, $quantity, $notes]);
        }
        writeAuditLog($pdo, (int) $admin['id'], 'save', 'lab_kit', $id, ['name' => $name, 'items' => count($items)]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    jsonResponse(['ok' => true, 'message' => 'Kit salvo.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/lab-kit/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id) jsonResponse(['ok' => false, 'message' => 'Kit inválido.'], 422);
    $pdo->prepare("UPDATE lab_kits SET status = 'inactive' WHERE id = ?")->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'deactivate', 'lab_kit', $id);
    jsonResponse(['ok' => true, 'message' => 'Kit desativado.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/kit-assignment/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $studentId = nullableInt($data['student_id'] ?? null);
    $kitId = nullableInt($data['kit_id'] ?? null);
    $moduleId = nullableInt($data['module_id'] ?? null);
    $notes = cleanString($data['notes'] ?? '', 500);
    $status = cleanString($data['status'] ?? 'active', 20);
    if (!$studentId || !$kitId || !in_array($status, ['active', 'returned', 'lost', 'maintenance'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Vínculo de kit inválido.'], 422);
    }
    if ($id) {
        $statement = $pdo->prepare("UPDATE student_kit_assignments SET student_id = ?, kit_id = ?, module_id = ?, notes = ?, status = ?, returned_at = IF(? = 'returned', COALESCE(returned_at, NOW()), NULL) WHERE id = ?");
        $statement->execute([$studentId, $kitId, $moduleId, $notes, $status, $status, $id]);
    } else {
        $statement = $pdo->prepare('INSERT INTO student_kit_assignments (student_id, kit_id, module_id, status, assigned_by, notes) VALUES (?, ?, ?, ?, ?, ?)');
        $statement->execute([$studentId, $kitId, $moduleId, $status, (int) $admin['id'], $notes]);
        $id = (int) $pdo->lastInsertId();
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'kit_assignment', $id, ['student_id' => $studentId, 'kit_id' => $kitId]);
    jsonResponse(['ok' => true, 'message' => 'Kit vinculado ao aluno.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/kit-assignment/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id) jsonResponse(['ok' => false, 'message' => 'Vínculo inválido.'], 422);
    $pdo->prepare("UPDATE student_kit_assignments SET status = 'returned', returned_at = NOW() WHERE id = ?")->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'return', 'kit_assignment', $id);
    jsonResponse(['ok' => true, 'message' => 'Devolução registrada.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/student-material/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $studentId = nullableInt($data['student_id'] ?? null);
    $name = requiredString($data, 'name', 120);
    $quantity = max(1, nullableInt($data['quantity'] ?? 1) ?? 1);
    $notes = cleanString($data['notes'] ?? '', 500);
    $status = cleanString($data['status'] ?? 'active', 20);
    if (!$studentId || !in_array($status, ['active', 'inactive'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Material inválido.'], 422);
    }
    if ($id) {
        $pdo->prepare('UPDATE student_materials SET student_id = ?, name = ?, quantity = ?, notes = ?, status = ? WHERE id = ?')
            ->execute([$studentId, $name, $quantity, $notes, $status, $id]);
    } else {
        $pdo->prepare('INSERT INTO student_materials (student_id, name, quantity, notes, status) VALUES (?, ?, ?, ?, ?)')
            ->execute([$studentId, $name, $quantity, $notes, $status]);
        $id = (int) $pdo->lastInsertId();
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'student_material', $id, ['student_id' => $studentId, 'name' => $name]);
    jsonResponse(['ok' => true, 'message' => 'Material salvo.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/student-material/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id) jsonResponse(['ok' => false, 'message' => 'Material inválido.'], 422);
    $pdo->prepare("UPDATE student_materials SET status = 'inactive' WHERE id = ?")->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'deactivate', 'student_material', $id);
    jsonResponse(['ok' => true, 'message' => 'Material desativado.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/pedagogical-note/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $data = requestData();
    $id = nullableInt($data['id'] ?? null);
    $studentId = nullableInt($data['student_id'] ?? null);
    $note = requiredString($data, 'note', 10000);
    $visibility = cleanString($data['visibility'] ?? 'staff', 20);
    if (!$studentId || !in_array($visibility, ['staff', 'supervision'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Observação inválida.'], 422);
    }
    $classStatement = $pdo->prepare('SELECT class_id FROM students WHERE user_id = ?');
    $classStatement->execute([$studentId]);
    $classId = $classStatement->fetchColumn();
    if ($classId === false) jsonResponse(['ok' => false, 'message' => 'Aluno não encontrado.'], 404);
    if ($id) {
        $pdo->prepare('UPDATE pedagogical_notes SET student_id = ?, class_id = ?, note = ?, visibility = ? WHERE id = ?')
            ->execute([$studentId, $classId ?: null, $note, $visibility, $id]);
    } else {
        $pdo->prepare('INSERT INTO pedagogical_notes (student_id, author_user_id, class_id, note, visibility) VALUES (?, ?, ?, ?, ?)')
            ->execute([$studentId, (int) $admin['id'], $classId ?: null, $note, $visibility]);
        $id = (int) $pdo->lastInsertId();
    }
    writeAuditLog($pdo, (int) $admin['id'], 'save', 'pedagogical_note', $id, ['student_id' => $studentId, 'visibility' => $visibility]);
    jsonResponse(['ok' => true, 'message' => 'Observação salva.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/pedagogical-note/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'students.manage');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id) jsonResponse(['ok' => false, 'message' => 'Observação inválida.'], 422);
    $pdo->prepare("UPDATE pedagogical_notes SET status = 'inactive' WHERE id = ?")->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'archive', 'pedagogical_note', $id);
    jsonResponse(['ok' => true, 'message' => 'Observação arquivada.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/mission-prerequisite/save') {
    requireMethod('POST', 'PUT');
    $admin = requirePermission($pdo, 'missions.manage');
    requireCsrf();
    $data = requestData();
    $missionId = nullableInt($data['mission_id'] ?? null);
    $prerequisiteId = nullableInt($data['prerequisite_mission_id'] ?? null);
    $enabled = boolValue($data['enabled'] ?? true);
    if (!$missionId || !$prerequisiteId || $missionId === $prerequisiteId) {
        jsonResponse(['ok' => false, 'message' => 'Pré-requisito inválido.'], 422);
    }
    if ($enabled) {
        $pairs = $pdo->query('SELECT mission_id, prerequisite_mission_id FROM mission_prerequisites')->fetchAll();
        $graph = [];
        foreach ($pairs as $pair) $graph[(int) $pair['mission_id']][] = (int) $pair['prerequisite_mission_id'];
        $graph[$missionId][] = $prerequisiteId;
        $stack = [$prerequisiteId];
        $visited = [];
        while ($stack) {
            $current = array_pop($stack);
            if ($current === $missionId) jsonResponse(['ok' => false, 'message' => 'Este vínculo criaria um ciclo entre missões.'], 409);
            if (isset($visited[$current])) continue;
            $visited[$current] = true;
            foreach ($graph[$current] ?? [] as $next) $stack[] = $next;
        }
        $pdo->prepare('INSERT IGNORE INTO mission_prerequisites (mission_id, prerequisite_mission_id) VALUES (?, ?)')
            ->execute([$missionId, $prerequisiteId]);
        $action = 'link';
    } else {
        $pdo->prepare('DELETE FROM mission_prerequisites WHERE mission_id = ? AND prerequisite_mission_id = ?')
            ->execute([$missionId, $prerequisiteId]);
        $action = 'unlink';
    }
    writeAuditLog($pdo, (int) $admin['id'], $action, 'mission_prerequisite', $missionId . ':' . $prerequisiteId);
    jsonResponse(['ok' => true, 'message' => 'Pré-requisito atualizado.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'admin/mission-support/upload') {
    requireMethod('POST');
    $admin = requirePermission($pdo, 'missions.manage');
    requireCsrf();
    $missionId = nullableInt($_POST['mission_id'] ?? null);
    if (!$missionId || empty($_FILES['file']) || !is_array($_FILES['file'])) {
        jsonResponse(['ok' => false, 'message' => 'Selecione uma missão e um arquivo.'], 422);
    }
    $file = $_FILES['file'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        jsonResponse(['ok' => false, 'message' => 'Falha ao receber o arquivo.'], 422);
    }
    $size = (int) ($file['size'] ?? 0);
    $originalName = basename((string) ($file['name'] ?? ''));
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if ($size <= 0 || $size > (int) $config['uploads']['max_file_size']
        || !in_array($extension, $config['uploads']['allowed_extensions'], true)) {
        jsonResponse(['ok' => false, 'message' => 'Formato ou tamanho de arquivo não permitido.'], 422);
    }
    $missionCheck = $pdo->prepare('SELECT id FROM missions WHERE id = ?');
    $missionCheck->execute([$missionId]);
    if (!$missionCheck->fetch()) jsonResponse(['ok' => false, 'message' => 'Missão não encontrada.'], 404);
    $relativeDirectory = 'support' . DIRECTORY_SEPARATOR . date('Y') . DIRECTORY_SEPARATOR . date('m');
    $targetDirectory = $config['uploads']['directory'] . DIRECTORY_SEPARATOR . $relativeDirectory;
    if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0750, true) && !is_dir($targetDirectory)) {
        throw new RuntimeException('Não foi possível criar a pasta de apoio.');
    }
    $storedName = bin2hex(random_bytes(20)) . '.' . $extension;
    $relativePath = $relativeDirectory . DIRECTORY_SEPARATOR . $storedName;
    $absolutePath = $config['uploads']['directory'] . DIRECTORY_SEPARATOR . $relativePath;
    if (!move_uploaded_file((string) $file['tmp_name'], $absolutePath)) {
        throw new RuntimeException('Não foi possível armazenar o arquivo.');
    }
    try {
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($absolutePath) ?: 'application/octet-stream';
        $orderStatement = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM mission_support_files WHERE mission_id = ?');
        $orderStatement->execute([$missionId]);
        $sortOrder = (int) $orderStatement->fetchColumn();
        $statement = $pdo->prepare('INSERT INTO mission_support_files (mission_id, original_name, stored_name, mime_type, file_size, file_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([$missionId, mb_substr($originalName, 0, 255, 'UTF-8'), $relativePath, $mime, $size, $extension, $sortOrder]);
        $id = (int) $pdo->lastInsertId();
        writeAuditLog($pdo, (int) $admin['id'], 'upload', 'mission_support_file', $id, ['mission_id' => $missionId, 'name' => $originalName]);
    } catch (Throwable $exception) {
        if (is_file($absolutePath)) @unlink($absolutePath);
        throw $exception;
    }
    jsonResponse(['ok' => true, 'message' => 'Arquivo de apoio enviado.', 'data' => $service->bootstrap($admin)], 201);
}

if ($route === 'admin/mission-support/delete') {
    requireMethod('DELETE', 'POST');
    $admin = requirePermission($pdo, 'missions.manage');
    requireCsrf();
    $id = nullableInt(requestData()['id'] ?? null);
    if (!$id) jsonResponse(['ok' => false, 'message' => 'Arquivo inválido.'], 422);
    $pdo->prepare("UPDATE mission_support_files SET status = 'archived' WHERE id = ?")->execute([$id]);
    writeAuditLog($pdo, (int) $admin['id'], 'archive', 'mission_support_file', $id);
    jsonResponse(['ok' => true, 'message' => 'Arquivo de apoio arquivado.', 'data' => $service->bootstrap($admin)]);
}

if ($route === 'reports/students.csv') {
    requireMethod('GET');
    requirePermission($pdo, 'reports.view');
    $rows = $service->bootstrap(currentUser())['students'];
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="relatorio-alunos-' . date('Y-m-d') . '.csv"');
    echo "\xEF\xBB\xBF";
    $output = fopen('php://output', 'wb');
    fputcsv($output, ['Aluno', 'E-mail', 'Turma', 'Módulo', 'Concluídas', 'Total', 'Progresso', 'Status'], ';');
    foreach ($rows as $student) {
        fputcsv($output, [
            $student['name'],
            $student['email'],
            $student['turma'],
            $student['modulo'],
            $student['missoesConcluidas'],
            $student['missoesTotal'],
            $student['progresso'] . '%',
            $student['status'],
        ], ';');
    }
    fclose($output);
    exit;
}

jsonResponse(['ok' => false, 'message' => 'Rota não encontrada.'], 404);
