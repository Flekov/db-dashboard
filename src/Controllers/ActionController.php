<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class ActionController
{
    public function list(array $params): void
    {
        (new AuthService())->requireUser();
        $pdo = Connection::get();
        $stmt = $pdo->prepare('SELECT * FROM actions WHERE project_id = :project_id ORDER BY id DESC');
        $stmt->execute([':project_id' => $params['id'] ?? 0]);
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function create(array $params): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $projectId = (int) ($params['id'] ?? 0);

        if ($projectId <= 0 || empty($data['action_type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('INSERT INTO actions (project_id, action_type, status, payload_json, created_at) VALUES (:project_id, :action_type, :status, :payload_json, :created_at)');
        $stmt->execute([
            ':project_id' => $projectId,
            ':action_type' => trim($data['action_type']),
            ':status' => trim($data['status'] ?? 'queued'),
            ':payload_json' => json_encode($data['payload'] ?? [], JSON_UNESCAPED_UNICODE),
            ':created_at' => date('c'),
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }
}
