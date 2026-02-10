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
        $stmt = $pdo->prepare('SELECT id, code, name FROM projects WHERE id = :id');
        $stmt->execute([':id' => $projectId]);
        $project = $stmt->fetch();
        if (!$project) {
            Response::json(['error' => 'Project not found'], 404);
        }

        $basePath = trim((string) ($data['location'] ?? ''));
        if ($basePath === '') {
            Response::json(['error' => 'Backup path is required'], 422);
        }
        if (!is_dir($basePath)) {
            Response::json(['error' => 'Backup path does not exist'], 422);
        }

        $safeBase = rtrim($basePath, "\\/ \t\n\r\0\x0B");
        $projectLabel = (string) ($project['name'] ?? '');
        if ($projectLabel === '') {
            $projectLabel = (string) ($project['code'] ?? '');
        }
        if ($projectLabel === '') {
            $projectLabel = 'project_' . $projectId;
        }
        $projectLabel = preg_replace('/[^A-Za-z0-9-_]/', '_', $projectLabel);
        $timestamp = date('Ymd_His');
        $versionLabel = trim((string) ($data['version_label'] ?? ''));
        if ($versionLabel === '') {
            $versionLabel = $timestamp;
        }
        $versionLabel = preg_replace('/[^A-Za-z0-9-_]/', '_', $versionLabel);
        $backupDir = $safeBase . DIRECTORY_SEPARATOR . $projectLabel . '_' . $versionLabel;
        if (!is_dir($backupDir) && !mkdir($backupDir, 0775, true)) {
            Response::json(['error' => 'Unable to create backup directory'], 500);
        }

        $stmt = $pdo->prepare('SELECT name, body_json FROM templates WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $projectId]);
        $templates = $stmt->fetchAll();
        foreach ($templates as $row) {
            $templateName = trim((string) ($row['name'] ?? 'template'));
            if ($templateName === '') {
                $templateName = 'template';
            }
            $templateName = preg_replace('/[^A-Za-z0-9-_]/', '_', $templateName);

            $body = json_decode((string) ($row['body_json'] ?? ''), true);
            if (!is_array($body)) {
                $body = [];
            }

            $fileName = $templateName . '_' . $versionLabel . '.json';
            $filePath = $backupDir . DIRECTORY_SEPARATOR . $fileName;
            $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            if ($json === false || file_put_contents($filePath, $json) === false) {
                Response::json(['error' => 'Failed to write templates backup'], 500);
            }
        }

        $stmt = $pdo->prepare('INSERT INTO backups (project_id, backup_type, location, version_label, created_at) VALUES (:project_id, :backup_type, :location, :version_label, :created_at)');
        $stmt->execute([
            ':project_id' => $projectId,
            ':backup_type' => trim($data['backup_type']),
            ':location' => $backupDir,
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
