<?php
declare(strict_types=1);

/*
 * Variáveis de ambiente têm prioridade. Na hospedagem compartilhada, use
 * config.local.php (copie config.local.example.php) para guardar as credenciais.
 */
$local = is_file(__DIR__ . '/config.local.php')
    ? require __DIR__ . '/config.local.php'
    : [];

$database = array_merge([
    'host' => 'localhost',
    'port' => '3306',
    'name' => 'createjoy',
    'user' => 'root',
    'password' => '',
    'charset' => 'utf8mb4',
], is_array($local['database'] ?? null) ? $local['database'] : []);

$database['host'] = getenv('CREATEJOY_DB_HOST') ?: $database['host'];
$database['port'] = getenv('CREATEJOY_DB_PORT') ?: $database['port'];
$database['name'] = getenv('CREATEJOY_DB_NAME') ?: $database['name'];
$database['user'] = getenv('CREATEJOY_DB_USER') ?: $database['user'];
$database['password'] = getenv('CREATEJOY_DB_PASSWORD') ?: $database['password'];

return [
    'database' => $database,
    'uploads' => [
        'directory' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'uploads',
        'avatar_directory' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'avatars',
        'max_file_size' => 5 * 1024 * 1024,
        'max_image_size' => 1536 * 1024,
        'max_total_size' => 8 * 1024 * 1024,
        'max_files_per_submission' => 3,
        'allowed_extensions' => ['ino', 'cpp', 'c', 'h', 'stl', 'pdf', 'png', 'jpg', 'jpeg', 'zip'],
    ],
];
