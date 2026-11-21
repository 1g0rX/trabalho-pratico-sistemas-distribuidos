<?php
declare(strict_types=1);

$config = require dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/Database.php';
require_once dirname(__DIR__) . '/api/helpers.php';
require_once dirname(__DIR__) . '/api/DataService.php';

$pdo = Database::connection($config);
$tables = $pdo->query("
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    ORDER BY table_name
")->fetchAll(PDO::FETCH_COLUMN);

$adminStatement = $pdo->query("
    SELECT id, name, email, role, password_hash, must_change_password
    FROM users
    WHERE role = 'admin' AND status = 'active'
    ORDER BY id
    LIMIT 1
");
$admin = $adminStatement->fetch();
if (!$admin) {
    throw new RuntimeException('Nenhum Admin Geral ativo foi encontrado.');
}
$admin['id'] = (int) $admin['id'];
$admin['initials'] = initials($admin['name']);
$adminPasswordValid = password_verify('Admin@123', $admin['password_hash']);
$adminMustChangePassword = (bool) $admin['must_change_password'];
unset($admin['password_hash'], $admin['must_change_password']);

$data = (new DataService($pdo))->bootstrap($admin);

echo json_encode([
    'ok' => true,
    'database' => $config['database']['name'],
    'tables' => count($tables),
    'schemaVersion' => $pdo->query('SELECT version FROM schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1')->fetchColumn(),
    'initialAdmin' => [
        'email' => $admin['email'],
        'temporaryPasswordValid' => $adminPasswordValid,
        'mustChangePassword' => $adminMustChangePassword,
    ],
    'content' => [
        'students' => count($data['students']),
        'teachers' => count($data['teachers']),
        'modules' => count($data['modules']),
        'classes' => count($data['classes']),
        'missions' => count($data['missions']),
        'submissions' => count($data['submissions']),
        'activities' => count($data['activities']),
        'storeRequests' => count($data['storeRequests']),
    ],
    'structural' => [
        'roles' => count($data['permissions']['roles']),
        'permissions' => count($data['permissions']['items']),
        'curriculumLevels' => count($data['curriculumLevels']),
        'storeProducts' => count($data['storeProducts']),
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
