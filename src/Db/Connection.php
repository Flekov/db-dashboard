<?php

namespace App\Db;

use PDO;

final class Connection
{
    private static ?PDO $pdo = null;

    public static function get(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $configPath = BASE_PATH . '/config.json';
        if (!file_exists($configPath)) {
            throw new \RuntimeException('Missing config.json');
        }

        $config = json_decode(file_get_contents($configPath), true);
        if (!is_array($config)) {
            throw new \RuntimeException('Invalid config.json');
        }

        $db = $config['db'] ?? [];

        $host = $db['host'] ?? '127.0.0.1';
        $port = (int) ($db['port'] ?? 3306);
        $name = $db['name'] ?? 'db_dashboard';
        $charset = $db['charset'] ?? 'utf8mb4';
        $user = $db['user'] ?? 'root';
        $pass = $db['pass'] ?? '';

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);
        self::$pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        return self::$pdo;
    }
}
