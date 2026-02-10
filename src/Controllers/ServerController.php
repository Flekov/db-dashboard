<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class ServerController
{
    public function list(): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $pdo = Connection::get();
        $projectId = (int) ($_GET['project_id'] ?? 0);
        $projectName = trim((string) ($_GET['project'] ?? ''));

        $baseJoin = ' FROM servers s JOIN projects p ON p.id = s.project_id';
        $accessJoin = '';
        $accessWhere = '';
        $params = [];

        if ($current['role'] !== 'admin') {
            $accessJoin = ' LEFT JOIN project_participants pp ON pp.project_id = p.id';
            $accessWhere = ' (p.owner_id = :user_id OR pp.user_id = :user_id)';
            $params[':user_id'] = (int) $current['id'];
        }

        if ($projectId > 0) {
            $where = ' s.project_id = :project_id';
            $params[':project_id'] = $projectId;
            if ($accessWhere) {
                $where = $where . ' AND ' . $accessWhere;
            }
            $stmt = $pdo->prepare('SELECT s.*, p.name AS project_name' . $baseJoin . $accessJoin . ' WHERE ' . $where . ' ORDER BY s.id DESC');
            $stmt->execute($params);
            Response::json(['items' => $stmt->fetchAll()]);
        }

        if ($projectName !== '') {
            $where = ' p.name LIKE :name';
            $params[':name'] = '%' . $projectName . '%';
            if ($accessWhere) {
                $where = $where . ' AND ' . $accessWhere;
            }
            $stmt = $pdo->prepare('SELECT s.*, p.name AS project_name' . $baseJoin . $accessJoin . ' WHERE ' . $where . ' ORDER BY s.id DESC');
            $stmt->execute($params);
            Response::json(['items' => $stmt->fetchAll()]);
        }

        $query = 'SELECT s.*, p.name AS project_name' . $baseJoin . $accessJoin;
        if ($accessWhere) {
            $query .= ' WHERE ' . $accessWhere;
        }
        $query .= ' ORDER BY s.id DESC';
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function create(): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $projectId = (int) ($data['project_id'] ?? 0);
        if ($projectId <= 0 || empty($data['name']) || empty($data['host']) || empty($data['type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = :id');
        $stmt->execute([':id' => $projectId]);
        if (!$stmt->fetch()) {
            Response::json(['error' => 'Project not found'], 404);
        }

        $stmt = $pdo->prepare('INSERT INTO servers (project_id, name, host, port, type, version, db_user, db_pass, charset, created_at) VALUES (:project_id, :name, :host, :port, :type, :version, :db_user, :db_pass, :charset, :created_at)');
        $stmt->execute([
            ':project_id' => $projectId,
            ':name' => trim($data['name']),
            ':host' => trim($data['host']),
            ':port' => (int) ($data['port'] ?? 3306),
            ':type' => trim($data['type']),
            ':version' => trim($data['version'] ?? ''),
            ':db_user' => trim($data['db_user'] ?? ''),
            ':db_pass' => trim($data['db_pass'] ?? ''),
            ':charset' => trim($data['charset'] ?? ''),
            ':created_at' => date('c'),
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }

    public function update(array $params): void
    {
        (new AuthService())->requireUser();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid server id'], 422);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $projectId = (int) ($data['project_id'] ?? 0);
        if (empty($data['name']) || empty($data['host']) || empty($data['type'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        if ($projectId > 0) {
            $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = :id');
            $stmt->execute([':id' => $projectId]);
            if (!$stmt->fetch()) {
                Response::json(['error' => 'Project not found'], 404);
            }
        }

        $stmt = $pdo->prepare('UPDATE servers SET name = :name, host = :host, port = :port, type = :type, version = :version, db_user = :db_user, db_pass = :db_pass, charset = :charset' . ($projectId > 0 ? ', project_id = :project_id' : '') . ' WHERE id = :id');
        $params = [
            ':name' => trim($data['name']),
            ':host' => trim($data['host']),
            ':port' => (int) ($data['port'] ?? 3306),
            ':type' => trim($data['type']),
            ':version' => trim($data['version'] ?? ''),
            ':db_user' => trim($data['db_user'] ?? ''),
            ':db_pass' => trim($data['db_pass'] ?? ''),
            ':charset' => trim($data['charset'] ?? ''),
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
            Response::json(['error' => 'Invalid server id'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('DELETE FROM servers WHERE id = :id');
        $stmt->execute([':id' => $id]);

        Response::json(['ok' => true]);
    }
}
