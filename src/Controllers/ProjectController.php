<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class ProjectController
{
    public function list(): void
    {
        (new AuthService())->requireUser();
        $pdo = Connection::get();
        $stmt = $pdo->query('SELECT * FROM projects ORDER BY id DESC');
        $items = $stmt->fetchAll();
        Response::json(['items' => $items]);
    }

    public function show(array $params): void
    {
        (new AuthService())->requireUser();
        $pdo = Connection::get();
        $stmt = $pdo->prepare('SELECT * FROM projects WHERE id = :id');
        $stmt->execute([':id' => $params['id'] ?? 0]);
        $item = $stmt->fetch();
        if (!$item) {
            Response::json(['error' => 'Project not found'], 404);
        }
        Response::json(['item' => $item]);
    }

    public function create(): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['code']) || empty($data['name'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('INSERT INTO projects (code, name, short_name, version, type, status, created_at) VALUES (:code, :name, :short_name, :version, :type, :status, :created_at)');
        $stmt->execute([
            ':code' => trim($data['code']),
            ':name' => trim($data['name']),
            ':short_name' => trim($data['short_name'] ?? ''),
            ':version' => trim($data['version'] ?? ''),
            ':type' => trim($data['type'] ?? ''),
            ':status' => 'active',
            ':created_at' => date('c'),
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }

    public function import(): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $data['items'] ?? [];

        if (!is_array($items)) {
            Response::json(['error' => 'Invalid payload'], 422);
        }

        $pdo = Connection::get();
        $pdo->beginTransaction();

        foreach ($items as $item) {
            if (empty($item['code']) || empty($item['name'])) {
                continue;
            }

            $stmt = $pdo->prepare('INSERT INTO projects (code, name, short_name, version, type, status, created_at) VALUES (:code, :name, :short_name, :version, :type, :status, :created_at)');
            $stmt->execute([
                ':code' => trim((string) $item['code']),
                ':name' => trim((string) $item['name']),
                ':short_name' => trim((string) ($item['short_name'] ?? '')),
                ':version' => trim((string) ($item['version'] ?? '')),
                ':type' => trim((string) ($item['type'] ?? '')),
                ':status' => 'active',
                ':created_at' => date('c'),
            ]);

            $projectId = (int) $pdo->lastInsertId();
            $participants = $item['participants'] ?? [];
            if (is_array($participants)) {
                foreach ($participants as $participant) {
                    $stmt = $pdo->prepare('INSERT INTO project_participants (project_id, participant_code) VALUES (:project_id, :participant_code)');
                    $stmt->execute([
                        ':project_id' => $projectId,
                        ':participant_code' => (string) $participant,
                    ]);
                }
            }
        }

        $pdo->commit();
        Response::json(['ok' => true]);
    }
}
