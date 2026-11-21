<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/AchievementService.php';
require_once __DIR__ . '/DataService.php';

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('session.use_strict_mode', '1');
$sessionDirectory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'sessions';
if (!is_dir($sessionDirectory)) {
    mkdir($sessionDirectory, 0750, true);
}
if (is_dir($sessionDirectory) && is_writable($sessionDirectory)) {
    session_save_path($sessionDirectory);
}
session_name('CREATEJOYSESSID');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Permissions-Policy: camera=(), microphone=(), geolocation=()");

set_exception_handler(static function (Throwable $exception): void {
    error_log(sprintf(
        '[CreateJoy] %s in %s:%d',
        $exception->getMessage(),
        $exception->getFile(),
        $exception->getLine()
    ));

    if ($exception instanceof PDOException && $exception->getCode() === '23000') {
        $message = 'Já existe um registro com esses dados ou há um vínculo que impede esta ação.';
    } elseif ($exception instanceof PDOException) {
        $message = 'Não foi possível concluir a operação no banco de dados. Confira api/config.local.php e os dados informados.';
    } else {
        $message = 'Ocorreu um erro interno. Tente novamente.';
    }

    jsonResponse(['ok' => false, 'message' => $message], 500);
});

$pdo = Database::connection($config);
