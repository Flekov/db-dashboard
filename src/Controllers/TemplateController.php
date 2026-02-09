<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class TemplateController
{
    public function list(): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $pdo = Connection::get();
        $projectId = (int) ($_GET['project_id'] ?? 0);
        $projectName = trim((string) ($_GET['project'] ?? ''));

        $baseJoin = ' FROM templates t JOIN projects p ON p.id = t.project_id';
        $accessJoin = '';
        $accessWhere = '';
        $params = [];

        if ($current['role'] !== 'admin') {
            $accessJoin = ' LEFT JOIN project_participants pp ON pp.project_id = p.id';
            $accessWhere = ' (p.owner_id = :user_id OR pp.user_id = :user_id)';
            $params[':user_id'] = (int) $current['id'];
        }

        if ($projectId > 0) {
            $where = ' t.project_id = :project_id';
            $params[':project_id'] = $projectId;
            if ($accessWhere) {
                $where = $where . ' AND ' . $accessWhere;
            }
            $stmt = $pdo->prepare('SELECT t.*, p.name AS project_name' . $baseJoin . $accessJoin . ' WHERE ' . $where . ' ORDER BY t.id DESC');
            $stmt->execute($params);
            Response::json(['items' => $stmt->fetchAll()]);
        }

        if ($projectName !== '') {
            $where = ' p.name LIKE :name';
            $params[':name'] = '%' . $projectName . '%';
            if ($accessWhere) {
                $where = $where . ' AND ' . $accessWhere;
            }
            $stmt = $pdo->prepare('SELECT t.*, p.name AS project_name' . $baseJoin . $accessJoin . ' WHERE ' . $where . ' ORDER BY t.id DESC');
            $stmt->execute($params);
            Response::json(['items' => $stmt->fetchAll()]);
        }

        $query = 'SELECT t.*, p.name AS project_name' . $baseJoin . $accessJoin;
        if ($accessWhere) {
            $query .= ' WHERE ' . $accessWhere;
        }
        $query .= ' ORDER BY t.id DESC';
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function create(): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $projectId = (int) ($data['project_id'] ?? 0);
        if ($projectId <= 0 || empty($data['name']) || empty($data['db_type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = :id');
        $stmt->execute([':id' => $projectId]);
        if (!$stmt->fetch()) {
            Response::json(['error' => 'Project not found'], 404);
        }

        $stmt = $pdo->prepare('SELECT id FROM templates WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $projectId]);
        if ($stmt->fetch()) {
            Response::json(['error' => 'Template already exists for project'], 409);
        }

        $stmt = $pdo->prepare('INSERT INTO templates (project_id, name, db_type, db_version, stack_version, notes, body_json, created_at) VALUES (:project_id, :name, :db_type, :db_version, :stack_version, :notes, :body_json, :created_at)');
        $stmt->execute([
            ':project_id' => $projectId,
            ':name' => trim($data['name']),
            ':db_type' => trim($data['db_type']),
            ':db_version' => trim($data['db_version'] ?? ''),
            ':stack_version' => trim($data['stack_version'] ?? ''),
            ':notes' => trim($data['notes'] ?? ''),
            ':body_json' => json_encode($data['body'] ?? [], JSON_UNESCAPED_UNICODE),
            ':created_at' => date('c'),
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }

    public function update(array $params): void
    {
        (new AuthService())->requireUser();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid template id'], 422);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $projectId = (int) ($data['project_id'] ?? 0);
        if (empty($data['name']) || empty($data['db_type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        if ($projectId > 0) {
            $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = :id');
            $stmt->execute([':id' => $projectId]);
            if (!$stmt->fetch()) {
                Response::json(['error' => 'Project not found'], 404);
            }
            $stmt = $pdo->prepare('SELECT id FROM templates WHERE project_id = :project_id AND id <> :id');
            $stmt->execute([':project_id' => $projectId, ':id' => $id]);
            if ($stmt->fetch()) {
                Response::json(['error' => 'Template already exists for project'], 409);
            }
        }

        $stmt = $pdo->prepare('UPDATE templates SET name = :name, db_type = :db_type, db_version = :db_version, stack_version = :stack_version, notes = :notes, body_json = :body_json' . ($projectId > 0 ? ', project_id = :project_id' : '') . ' WHERE id = :id');
        $params = [
            ':name' => trim($data['name']),
            ':db_type' => trim($data['db_type']),
            ':db_version' => trim($data['db_version'] ?? ''),
            ':stack_version' => trim($data['stack_version'] ?? ''),
            ':notes' => trim($data['notes'] ?? ''),
            ':body_json' => json_encode($data['body'] ?? [], JSON_UNESCAPED_UNICODE),
            ':id' => $id,
        ];
        if ($projectId > 0) {
            $params[':project_id'] = $projectId;
        }
        $stmt->execute($params);

        Response::json(['ok' => true]);
    }

    public function delete(array $params): void
    {
        (new AuthService())->requireUser();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid template id'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('DELETE FROM templates WHERE id = :id');
        $stmt->execute([':id' => $id]);

        Response::json(['ok' => true]);
    }
}
