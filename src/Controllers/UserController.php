<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class UserController
{
    public function list(): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();

        $pdo = Connection::get();
        $stmt = $pdo->query('SELECT id, name, email, faculty_number FROM users ORDER BY id ASC');
        $items = $stmt->fetchAll();

        $rolesByUser = [];
        $roleStmt = $pdo->query('SELECT ur.user_id, r.name AS role_name FROM user_roles ur JOIN roles r ON r.id = ur.role_id');
        foreach ($roleStmt->fetchAll() as $row) {
            $rolesByUser[$row['user_id']] = $row['role_name'];
        }

        $items = array_map(function (array $item) use ($rolesByUser) {
            $item['role'] = $rolesByUser[$item['id']] ?? 'user';
            return $item;
        }, $items);

        Response::json(['items' => $items]);
    }

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
        $facultyNumber = trim((string) ($data['faculty_number'] ?? ''));
        $roleName = trim((string) ($data['role'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $passwordConfirm = (string) ($data['password_confirm'] ?? '');

        if ($password !== '' && $password !== $passwordConfirm) {
            Response::json(['error' => 'Passwords do not match'], 422);
        }

        $pdo = Connection::get();
        if ($name === '' || $email === '') {
            if ($password === '') {
                Response::json(['error' => 'Missing fields'], 422);
            }
            $stmt = $pdo->prepare('SELECT name, email, faculty_number FROM users WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $existing = $stmt->fetch();
            if (!$existing) {
                Response::json(['error' => 'User not found'], 404);
            }
            $name = $existing['name'];
            $email = $existing['email'];
            $facultyNumber = $existing['faculty_number'] ?? '';
        }

        $updateSql = 'UPDATE users SET name = :name, email = :email, faculty_number = :faculty_number';
        $params = [
            ':name' => $name,
            ':email' => $email,
            ':faculty_number' => $facultyNumber !== '' ? $facultyNumber : null,
            ':id' => $id,
        ];
        if ($password !== '') {
            $updateSql .= ', password_hash = :password_hash';
            $params[':password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }
        $updateSql .= ' WHERE id = :id';
        $stmt = $pdo->prepare($updateSql);
        $stmt->execute($params);

        if ($current['role'] === 'admin' && $roleName !== '') {
            $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = :name');
            $stmt->execute([':name' => $roleName]);
            $role = $stmt->fetch();
            if ($role) {
                $stmt = $pdo->prepare('DELETE FROM user_roles WHERE user_id = :user_id');
                $stmt->execute([':user_id' => $id]);
                $stmt = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)');
                $stmt->execute([
                    ':user_id' => $id,
                    ':role_id' => $role['id'],
                ]);
            }
        }

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
