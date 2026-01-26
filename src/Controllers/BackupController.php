<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class BackupController
{
    public function list(array $params): void
    {
        (new AuthService())->requireUser();
        $pdo = Connection::get();
        $stmt = $pdo->prepare('SELECT * FROM backups WHERE project_id = :project_id ORDER BY id DESC');
        $stmt->execute([':project_id' => $params['id'] ?? 0]);
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function create(array $params): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $projectId = (int) ($params['id'] ?? 0);

        if ($projectId <= 0 || empty($data['backup_type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('INSERT INTO backups (project_id, backup_type, location, version_label, created_at) VALUES (:project_id, :backup_type, :location, :version_label, :created_at)');
        $stmt->execute([
            ':project_id' => $projectId,
            ':backup_type' => trim($data['backup_type']),
            ':location' => trim($data['location'] ?? ''),
            ':version_label' => trim($data['version_label'] ?? ''),
            ':created_at' => date('c'),
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }
}
