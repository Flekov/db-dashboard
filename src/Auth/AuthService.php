<?php

namespace App\Auth;

use App\Db\Connection;
use App\Http\Response;
use PDO;

final class AuthService
{
    public function register(array $data): array
    {
        $email = trim($data['email'] ?? '');
        $name = trim($data['name'] ?? '');
        $password = $data['password'] ?? '';
        $facultyNumber = trim($data['faculty_number'] ?? '');

        if ($email === '' || $name === '' || $password === '') {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('INSERT INTO users (name, email, faculty_number, password_hash, created_at) VALUES (:name, :email, :faculty_number, :hash, :created_at)');
        $stmt->execute([
            ':name' => $name,
            ':email' => $email,
            ':faculty_number' => $facultyNumber !== '' ? $facultyNumber : null,
            ':hash' => $hash,
            ':created_at' => date('c'),
        ]);

        $userId = (int) $pdo->lastInsertId();
        $roleName = 'admin';
        $this->attachRole($pdo, $userId, $roleName);

        $token = $this->createSession($pdo, $userId);

        return [
            'token' => $token,
            'user' => [
                'id' => $userId,
                'name' => $name,
                'email' => $email,
                'faculty_number' => $facultyNumber !== '' ? $facultyNumber : null,
                'role' => $roleName,
            ],
        ];
    }

    public function login(array $data): array
    {
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        if ($email === '' || $password === '') {
            Response::json(['error' => 'Missing credentials'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::json(['error' => 'Invalid credentials'], 401);
        }

        $token = $this->createSession($pdo, (int) $user['id']);
        $role = $this->getRole($pdo, (int) $user['id']);

        return [
            'token' => $token,
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $role,
            ],
        ];
    }

    public function logout(string $token): void
    {
        $pdo = Connection::get();
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE token = :token');
        $stmt->execute([':token' => $token]);
    }

    public function requireUser(): array
    {
        $token = $this->getBearerToken();
        if (!$token) {
            Response::json(['error' => 'Unauthorized'], 401);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('SELECT * FROM sessions WHERE token = :token');
        $stmt->execute([':token' => $token]);
        $session = $stmt->fetch();

        if (!$session || strtotime($session['expires_at']) < time()) {
            Response::json(['error' => 'Session expired'], 401);
        }

        $stmt = $pdo->prepare('SELECT id, name, email, faculty_number FROM users WHERE id = :id');
        $stmt->execute([':id' => $session['user_id']]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::json(['error' => 'User not found'], 404);
        }

        $role = $this->getRole($pdo, (int) $user['id']);
        $user['role'] = $role;
        $user['token'] = $token;

        return $user;
    }

    private function getRole(PDO $pdo, int $userId): string
    {
        $stmt = $pdo->prepare('SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = :id');
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch();

        return $row ? $row['name'] : 'user';
    }

    private function attachRole(PDO $pdo, int $userId, string $roleName): void
    {
        $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = :name');
        $stmt->execute([':name' => $roleName]);
        $role = $stmt->fetch();

        if (!$role) {
            return;
        }

        $stmt = $pdo->prepare('SELECT id FROM user_roles WHERE user_id = :user_id AND role_id = :role_id');
        $stmt->execute([
            ':user_id' => $userId,
            ':role_id' => $role['id'],
        ]);
        if ($stmt->fetch()) {
            return;
        }

        $stmt = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)');
        $stmt->execute([
            ':user_id' => $userId,
            ':role_id' => $role['id'],
        ]);
    }

    public function ensureRole(PDO $pdo, int $userId, string $roleName): void
    {
        $this->attachRole($pdo, $userId, $roleName);
    }

    private function createSession(PDO $pdo, int $userId): string
    {
        $token = bin2hex(random_bytes(24));
        $expires = date('c', strtotime('+7 days'));

        $stmt = $pdo->prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (:user_id, :token, :expires_at)');
        $stmt->execute([
            ':user_id' => $userId,
            ':token' => $token,
            ':expires_at' => $expires,
        ]);

        return $token;
    }

    private function getBearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (str_starts_with($header, 'Bearer ')) {
            return substr($header, 7);
        }

        return null;
    }
}
