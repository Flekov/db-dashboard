<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class BackupController
{
    public function list(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $pdo = Connection::get();
        $projectId = (int) ($params['id'] ?? ($_GET['project_id'] ?? 0));
        $projectName = trim((string) ($_GET['project'] ?? ''));

        $baseJoin = ' FROM backups b JOIN projects p ON p.id = b.project_id';
        $accessJoin = '';
        $accessWhere = '';
        $paramsSql = [];

        if ($current['role'] !== 'admin') {
            $accessJoin = ' LEFT JOIN project_participants pp ON pp.project_id = p.id';
            $accessWhere = ' (p.owner_id = :user_id OR pp.user_id = :user_id)';
            $paramsSql[':user_id'] = (int) $current['id'];
        }

        if ($projectId > 0) {
            $where = ' b.project_id = :project_id';
            $paramsSql[':project_id'] = $projectId;
            if ($accessWhere) {
                $where = $where . ' AND ' . $accessWhere;
            }
            $stmt = $pdo->prepare('SELECT b.*, p.name AS project_name' . $baseJoin . $accessJoin . ' WHERE ' . $where . ' ORDER BY b.id DESC');
            $stmt->execute($paramsSql);
            Response::json(['items' => $stmt->fetchAll()]);
        }

        if ($projectName !== '') {
            $where = ' p.name LIKE :name';
            $paramsSql[':name'] = '%' . $projectName . '%';
            if ($accessWhere) {
                $where = $where . ' AND ' . $accessWhere;
            }
            $stmt = $pdo->prepare('SELECT b.*, p.name AS project_name' . $baseJoin . $accessJoin . ' WHERE ' . $where . ' ORDER BY b.id DESC');
            $stmt->execute($paramsSql);
            Response::json(['items' => $stmt->fetchAll()]);
        }

        $query = 'SELECT b.*, p.name AS project_name' . $baseJoin . $accessJoin;
        if ($accessWhere) {
            $query .= ' WHERE ' . $accessWhere;
        }
        $query .= ' ORDER BY b.id DESC';
        $stmt = $pdo->prepare($query);
        $stmt->execute($paramsSql);
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
