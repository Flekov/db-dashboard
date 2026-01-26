<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class ServerController
{
    public function list(): void
    {
        (new AuthService())->requireUser();
        $pdo = Connection::get();
        $stmt = $pdo->query('SELECT * FROM servers ORDER BY id DESC');
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function create(): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['name']) || empty($data['host']) || empty($data['type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('INSERT INTO servers (name, host, port, type, version, root_user, created_at) VALUES (:name, :host, :port, :type, :version, :root_user, :created_at)');
        $stmt->execute([
            ':name' => trim($data['name']),
            ':host' => trim($data['host']),
            ':port' => (int) ($data['port'] ?? 3306),
            ':type' => trim($data['type']),
            ':version' => trim($data['version'] ?? ''),
            ':root_user' => trim($data['root_user'] ?? ''),
            ':created_at' => date('c'),
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }
}
