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

    public function update(array $params): void
    {
        (new AuthService())->requireUser();
        $projectId = (int) ($params['id'] ?? 0);
        $backupId = (int) ($params['backupId'] ?? 0);

        if ($projectId <= 0 || $backupId <= 0) {
            Response::json(['error' => 'Invalid backup id'], 422);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($data['backup_type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('UPDATE backups SET backup_type = :backup_type, location = :location, version_label = :version_label WHERE id = :id AND project_id = :project_id');
        $stmt->execute([
            ':backup_type' => trim($data['backup_type']),
            ':location' => trim($data['location'] ?? ''),
            ':version_label' => trim($data['version_label'] ?? ''),
            ':id' => $backupId,
            ':project_id' => $projectId,
        ]);

        Response::json(['ok' => true]);
    }

    public function delete(array $params): void
    {
        (new AuthService())->requireUser();
        $projectId = (int) ($params['id'] ?? 0);
        $backupId = (int) ($params['backupId'] ?? 0);

        if ($projectId <= 0 || $backupId <= 0) {
            Response::json(['error' => 'Invalid backup id'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('DELETE FROM backups WHERE id = :id AND project_id = :project_id');
        $stmt->execute([
            ':id' => $backupId,
            ':project_id' => $projectId,
        ]);

        Response::json(['ok' => true]);
    }
}
