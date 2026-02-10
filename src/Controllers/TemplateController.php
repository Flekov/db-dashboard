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
        $stmt = $pdo->prepare('SELECT is_locked FROM templates WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            Response::json(['error' => 'Template not found'], 404);
        }
        if ((int) ($existing['is_locked'] ?? 0) === 1) {
            Response::json(['error' => 'Template is locked'], 409);
        }
        if ($projectId > 0) {
            $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = :id');
            $stmt->execute([':id' => $projectId]);
            if (!$stmt->fetch()) {
                Response::json(['error' => 'Project not found'], 404);
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
        $stmt = $pdo->prepare('SELECT is_locked FROM templates WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            Response::json(['error' => 'Template not found'], 404);
        }
        if ((int) ($existing['is_locked'] ?? 0) === 1) {
            Response::json(['error' => 'Template is locked'], 409);
        }
        $stmt = $pdo->prepare('DELETE FROM templates WHERE id = :id');
        $stmt->execute([':id' => $id]);

        Response::json(['ok' => true]);
    }

    public function run(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid template id'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('SELECT t.*, p.name AS project_name, p.owner_id FROM templates t JOIN projects p ON p.id = t.project_id WHERE t.id = :id');
        $stmt->execute([':id' => $id]);
        $template = $stmt->fetch();
        if (!$template) {
            Response::json(['error' => 'Template not found'], 404);
        }

        if ($current['role'] !== 'admin' && !$this->canAccessProject($pdo, (int) $template['project_id'], (int) $current['id'])) {
            Response::json(['error' => 'Forbidden'], 403);
        }

        if ((int) ($template['is_locked'] ?? 0) === 1) {
            Response::json(['error' => 'Template is locked'], 409);
        }

        $body = json_decode((string) ($template['body_json'] ?? ''), true);
        if (!is_array($body)) {
            $body = [];
        }

        $dbName = $this->normalizeDatabaseName((string) ($template['project_name'] ?? ''));
        if ($dbName === '') {
            Response::json(['error' => 'Invalid project name'], 422);
        }

        $db = $this->connectProjectDatabase($dbName);
        $db->beginTransaction();
        try {
            foreach ($body as $value) {
                if (is_string($value) && trim($value) !== '') {
                    $db->exec($value);
                    continue;
                }
                if (is_array($value)) {
                    foreach ($value as $sql) {
                        if (is_string($sql) && trim($sql) !== '') {
                            $db->exec($sql);
                        }
                    }
                }
            }
            if ($db->inTransaction()) {
                $db->commit();
            }
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::json(['error' => 'Template execution failed', 'detail' => $e->getMessage()], 500);
        }

        $stmt = $pdo->prepare('UPDATE templates SET is_locked = 1, locked_at = :locked_at, last_run_at = :last_run_at WHERE id = :id');
        $stmt->execute([
            ':locked_at' => date('c'),
            ':last_run_at' => date('c'),
            ':id' => $id,
        ]);

        Response::json(['ok' => true]);
    }

    private function connectProjectDatabase(string $dbName): \PDO
    {
        $configPath = BASE_PATH . '/config.json';
        if (!file_exists($configPath)) {
            Response::json(['error' => 'Missing config.json'], 500);
        }
        $config = json_decode(file_get_contents($configPath), true);
        if (!is_array($config)) {
            Response::json(['error' => 'Invalid config.json'], 500);
        }
        $db = $config['db'] ?? [];
        $host = $db['host'] ?? '127.0.0.1';
        $port = (int) ($db['port'] ?? 3306);
        $charset = $db['charset'] ?? 'utf8mb4';
        $user = $db['user'] ?? 'root';
        $pass = $db['pass'] ?? '';

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $dbName, $charset);
        return new \PDO($dsn, $user, $pass, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);
    }

    private function normalizeDatabaseName(string $name): string
    {
        $normalized = preg_replace('/[^A-Za-z0-9_]+/', '_', $name);
        $normalized = trim((string) $normalized, '_');
        return strtolower($normalized);
    }

    private function canAccessProject(\PDO $pdo, int $projectId, int $userId): bool
    {
        $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = :id AND owner_id = :user_id');
        $stmt->execute([
            ':id' => $projectId,
            ':user_id' => $userId,
        ]);
        if ($stmt->fetch()) {
            return true;
        }
        $stmt = $pdo->prepare('SELECT id FROM project_participants WHERE project_id = :project_id AND user_id = :user_id');
        $stmt->execute([
            ':project_id' => $projectId,
            ':user_id' => $userId,
        ]);
        return (bool) $stmt->fetch();
    }
}
