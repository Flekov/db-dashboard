<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class TagController
{
    public function list(): void
    {
        (new AuthService())->requireUser();
        $pdo = Connection::get();
        $stmt = $pdo->query('SELECT id, name FROM tags ORDER BY name ASC');
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function create(): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        if ($current['role'] !== 'admin') {
            Response::json(['error' => 'Forbidden'], 403);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            Response::json(['error' => 'Missing fields'], 422);
        }
        $pdo = Connection::get();
        $stmt = $pdo->prepare('INSERT INTO tags (name) VALUES (:name)');
        $stmt->execute([':name' => $name]);
        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }

    public function update(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        if ($current['role'] !== 'admin') {
            Response::json(['error' => 'Forbidden'], 403);
        }
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid tag id'], 422);
        }
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            Response::json(['error' => 'Missing fields'], 422);
        }
        $pdo = Connection::get();
        $stmt = $pdo->prepare('UPDATE tags SET name = :name WHERE id = :id');
        $stmt->execute([':name' => $name, ':id' => $id]);
        Response::json(['ok' => true]);
    }

    public function delete(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        if ($current['role'] !== 'admin') {
            Response::json(['error' => 'Forbidden'], 403);
        }
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid tag id'], 422);
        }
        $pdo = Connection::get();
        $stmt = $pdo->prepare('DELETE FROM project_tags WHERE tag_id = :id');
        $stmt->execute([':id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM tags WHERE id = :id');
        $stmt->execute([':id' => $id]);
        Response::json(['ok' => true]);
    }
}
