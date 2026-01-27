<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class TemplateController
{
    public function list(): void
    {
        (new AuthService())->requireUser();
        $pdo = Connection::get();
        $stmt = $pdo->query('SELECT * FROM templates ORDER BY id DESC');
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function create(): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['name']) || empty($data['db_type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('INSERT INTO templates (name, db_type, db_version, stack_version, notes, body_json, created_at) VALUES (:name, :db_type, :db_version, :stack_version, :notes, :body_json, :created_at)');
        $stmt->execute([
            ':name' => trim($data['name']),
            ':db_type' => trim($data['db_type']),
            ':db_version' => trim($data['db_version'] ?? ''),
            ':stack_version' => trim($data['stack_version'] ?? ''),
            ':notes' => trim($data['notes'] ?? ''),
            ':body_json' => json_encode($data['body'] ?? [], JSON_UNESCAPED_UNICODE),
            ':created_at' => date('c'),
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }

    public function update(array $params): void
    {
        (new AuthService())->requireUser();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid template id'], 422);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($data['name']) || empty($data['db_type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('UPDATE templates SET name = :name, db_type = :db_type, db_version = :db_version, stack_version = :stack_version, notes = :notes, body_json = :body_json WHERE id = :id');
        $stmt->execute([
            ':name' => trim($data['name']),
            ':db_type' => trim($data['db_type']),
            ':db_version' => trim($data['db_version'] ?? ''),
            ':stack_version' => trim($data['stack_version'] ?? ''),
            ':notes' => trim($data['notes'] ?? ''),
            ':body_json' => json_encode($data['body'] ?? [], JSON_UNESCAPED_UNICODE),
            ':id' => $id,
        ]);

        Response::json(['ok' => true]);
    }

    public function delete(array $params): void
    {
        (new AuthService())->requireUser();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid template id'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('DELETE FROM templates WHERE id = :id');
        $stmt->execute([':id' => $id]);

        Response::json(['ok' => true]);
    }
}
