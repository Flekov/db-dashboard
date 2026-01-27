<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class UserController
{
    public function update(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $id = (int) ($params['id'] ?? 0);

        if ($id <= 0) {
            Response::json(['error' => 'Invalid user id'], 422);
        }

        if ($current['role'] !== 'admin' && (int) $current['id'] !== $id) {
            Response::json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim((string) ($data['name'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));

        if ($name === '' || $email === '') {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('UPDATE users SET name = :name, email = :email WHERE id = :id');
        $stmt->execute([
            ':name' => $name,
            ':email' => $email,
            ':id' => $id,
        ]);

        Response::json(['ok' => true]);
    }

    public function delete(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $id = (int) ($params['id'] ?? 0);

        if ($id <= 0) {
            Response::json(['error' => 'Invalid user id'], 422);
        }

        if ($current['role'] !== 'admin') {
            Response::json(['error' => 'Forbidden'], 403);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE user_id = :user_id');
        $stmt->execute([':user_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM user_roles WHERE user_id = :user_id');
        $stmt->execute([':user_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);

        Response::json(['ok' => true]);
    }
}
