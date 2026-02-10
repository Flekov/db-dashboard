<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class ProjectController
{
    public function list(): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $pdo = Connection::get();
        if ($current['role'] === 'admin') {
            $stmt = $pdo->query('SELECT p.*, u.name AS owner_name, u.email AS owner_email, u.faculty_number AS owner_faculty_number FROM projects p JOIN users u ON u.id = p.owner_id ORDER BY p.id DESC');
        } else {
            $stmt = $pdo->prepare('SELECT DISTINCT p.*, u.name AS owner_name, u.email AS owner_email, u.faculty_number AS owner_faculty_number FROM projects p JOIN users u ON u.id = p.owner_id LEFT JOIN project_participants pp ON pp.project_id = p.id WHERE p.owner_id = :user_id OR pp.user_id = :user_id ORDER BY p.id DESC');
            $stmt->execute([':user_id' => (int) $current['id']]);
        }
        $items = $stmt->fetchAll();
        $items = $this->attachParticipants($pdo, $items);
        $items = $this->attachTags($pdo, $items);

        $tagFilter = trim((string) ($_GET['tags'] ?? ''));
        if ($tagFilter !== '') {
            $required = array_values(array_filter(array_map(function (string $tag) {
                return strtolower(trim($tag));
            }, explode(',', $tagFilter))));
            if ($required) {
                $items = array_values(array_filter($items, function (array $item) use ($required) {
                    $tags = array_map('strtolower', $item['tags'] ?? []);
                    foreach ($required as $tag) {
                        if (!in_array($tag, $tags, true)) {
                            return false;
                        }
                    }
                    return true;
                }));
            }
        }
        Response::json(['items' => $items]);
    }

    public function show(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $pdo = Connection::get();
        $projectId = (int) ($params['id'] ?? 0);
        if ($projectId <= 0) {
            Response::json(['error' => 'Invalid project id'], 422);
        }

        $stmt = $pdo->prepare('SELECT p.*, u.name AS owner_name, u.email AS owner_email, u.faculty_number AS owner_faculty_number FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = :id');
        $stmt->execute([':id' => $projectId]);
        $item = $stmt->fetch();
        if (!$item) {
            Response::json(['error' => 'Project not found'], 404);
        }
        if ($current['role'] !== 'admin' && !$this->canAccessProject($pdo, $projectId, (int) $current['id'])) {
            Response::json(['error' => 'Forbidden'], 403);
        }
        $items = $this->attachParticipants($pdo, [$item]);
        $items = $this->attachTags($pdo, $items);
        $item = $items[0] ?? $item;
        Response::json(['item' => $item]);
    }

    public function create(): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['code']) || empty($data['name'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $name = trim((string) ($data['name'] ?? ''));
        $stmt = $pdo->prepare('SELECT id FROM projects WHERE name = :name');
        $stmt->execute([':name' => $name]);
        if ($stmt->fetch()) {
            Response::json(['error' => 'Project name must be unique'], 409);
        }

        $ownerEmail = trim((string) ($data['owner_email'] ?? ''));
        if ($current['role'] !== 'admin' || $ownerEmail === '') {
            $ownerId = (int) $current['id'];
        } else {
            $ownerId = $this->findUserIdByEmail($pdo, $ownerEmail);
            if (!$ownerId) {
                Response::json(['error' => 'Owner not found'], 422);
            }
        }

        $this->createProjectDatabase($name);

        $stmt = $pdo->prepare('INSERT INTO projects (code, name, short_name, version, type, status, owner_id, created_at) VALUES (:code, :name, :short_name, :version, :type, :status, :owner_id, :created_at)');
        $stmt->execute([
            ':code' => trim($data['code']),
            ':name' => $name,
            ':short_name' => trim($data['short_name'] ?? ''),
            ':version' => trim($data['version'] ?? ''),
            ':type' => trim($data['type'] ?? ''),
            ':status' => 'active',
            ':owner_id' => $ownerId,
            ':created_at' => date('c'),
        ]);

        $projectId = (int) $pdo->lastInsertId();
        $participants = $data['participants'] ?? [];
        if (is_array($participants)) {
            $this->replaceParticipants($pdo, $projectId, $participants);
        }
        if (array_key_exists('tags', $data) && is_array($data['tags'])) {
            $this->replaceTags($pdo, $projectId, $data['tags']);
        }

        Response::json(['id' => $projectId], 201);
    }

    public function import(): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $data;
        if (isset($data['items'])) {
            $items = $data['items'];
        }

        if (!is_array($items)) {
            Response::json(['error' => 'Invalid payload'], 422);
        }

        $pdo = Connection::get();
        $pdo->beginTransaction();

        foreach ($items as $item) {
            if (empty($item['code']) || empty($item['name'])) {
                continue;
            }

            $name = trim((string) $item['name']);
            if ($name === '') {
                continue;
            }

            $stmt = $pdo->prepare('SELECT id FROM projects WHERE name = :name');
            $stmt->execute([':name' => $name]);
            if ($stmt->fetch()) {
                continue;
            }

            $ownerPayload = $item['owner'] ?? null;
            $ownerEmail = '';
            $ownerName = '';
            $ownerFaculty = null;
            if (is_array($ownerPayload)) {
                $ownerEmail = trim((string) ($ownerPayload['email'] ?? ''));
                $ownerName = trim((string) ($ownerPayload['name'] ?? ''));
                $ownerFaculty = $ownerPayload['faculty_number'] ?? null;
            } else {
                $ownerEmail = trim((string) ($item['owner_email'] ?? $item['owner'] ?? ''));
            }

            if ($ownerEmail === '') {
                $ownerId = (int) $current['id'];
            } else {
                $ownerId = $this->findOrCreateUserForImport($pdo, [
                    'name' => $ownerName,
                    'email' => $ownerEmail,
                    'faculty_number' => $ownerFaculty,
                ], $auth);
            }

            $this->createProjectDatabase($name);

            $stmt = $pdo->prepare('INSERT INTO projects (code, name, short_name, version, type, status, owner_id, created_at) VALUES (:code, :name, :short_name, :version, :type, :status, :owner_id, :created_at)');
            $stmt->execute([
                ':code' => trim((string) $item['code']),
                ':name' => $name,
                ':short_name' => trim((string) ($item['short_name'] ?? '')),
                ':version' => trim((string) ($item['version'] ?? '')),
                ':type' => trim((string) ($item['type'] ?? '')),
                ':status' => 'active',
                ':owner_id' => $ownerId,
                ':created_at' => date('c'),
            ]);

            $projectId = (int) $pdo->lastInsertId();
            $participants = $item['participants'] ?? [];
            if (is_array($participants)) {
                $this->replaceParticipantsForImport($pdo, $projectId, $participants, $auth);
            }
            if (array_key_exists('tags', $item) && is_array($item['tags'])) {
                $this->replaceTags($pdo, $projectId, $item['tags']);
            }
        }

        $pdo->commit();
        Response::json(['ok' => true]);
    }

    public function update(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid project id'], 422);
        }
        $pdo = Connection::get();
        if ($current['role'] !== 'admin' && !$this->canAccessProject($pdo, $id, (int) $current['id'])) {
            Response::json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $fields = [
            'code' => trim((string) ($data['code'] ?? '')),
            'name' => trim((string) ($data['name'] ?? '')),
            'short_name' => trim((string) ($data['short_name'] ?? '')),
            'version' => trim((string) ($data['version'] ?? '')),
            'type' => trim((string) ($data['type'] ?? '')),
            'status' => trim((string) ($data['status'] ?? 'active')),
        ];

        if ($fields['code'] === '' || $fields['name'] === '') {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $ownerId = null;
        $ownerEmail = trim((string) ($data['owner_email'] ?? ''));
        if ($current['role'] === 'admin' && $ownerEmail !== '') {
            $ownerId = $this->findUserIdByEmail($pdo, $ownerEmail);
            if (!$ownerId) {
                Response::json(['error' => 'Owner not found'], 422);
            }
        }

        $stmt = $pdo->prepare('SELECT id FROM projects WHERE name = :name AND id <> :id');
        $stmt->execute([':name' => $fields['name'], ':id' => $id]);
        if ($stmt->fetch()) {
            Response::json(['error' => 'Project name must be unique'], 409);
        }

        $stmt = $pdo->prepare('UPDATE projects SET code = :code, name = :name, short_name = :short_name, version = :version, type = :type, status = :status' . ($ownerId ? ', owner_id = :owner_id' : '') . ' WHERE id = :id');
        $params = [
            ':code' => $fields['code'],
            ':name' => $fields['name'],
            ':short_name' => $fields['short_name'],
            ':version' => $fields['version'],
            ':type' => $fields['type'],
            ':status' => $fields['status'],
            ':id' => $id,
        ];
        if ($ownerId) {
            $params[':owner_id'] = $ownerId;
        }
        $stmt->execute($params);

        if (array_key_exists('participants', $data) && is_array($data['participants'])) {
            $this->replaceParticipants($pdo, $id, $data['participants']);
        }
        if (array_key_exists('tags', $data) && is_array($data['tags'])) {
            $this->replaceTags($pdo, $id, $data['tags']);
        }

        Response::json(['ok' => true]);
    }

    public function delete(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $id = (int) ($params['id'] ?? 0);
        if ($id <= 0) {
            Response::json(['error' => 'Invalid project id'], 422);
        }
        $pdo = Connection::get();
        if ($current['role'] !== 'admin' && !$this->canAccessProject($pdo, $id, (int) $current['id'])) {
            Response::json(['error' => 'Forbidden'], 403);
        }

        $stmt = $pdo->prepare('SELECT name FROM projects WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $project = $stmt->fetch();
        if (!$project) {
            Response::json(['error' => 'Project not found'], 404);
        }

        $pdo->beginTransaction();
        $stmt = $pdo->prepare('DELETE FROM project_tags WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM templates WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM servers WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM actions WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM backups WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM vhosts WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM project_participants WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM projects WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $pdo->commit();

        $this->dropProjectDatabase((string) $project['name']);

        Response::json(['ok' => true]);
    }

    public function participants(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $projectId = (int) ($params['id'] ?? 0);
        if ($projectId <= 0) {
            Response::json(['error' => 'Invalid project id'], 422);
        }

        $pdo = Connection::get();
        if ($current['role'] !== 'admin' && !$this->canAccessProject($pdo, $projectId, (int) $current['id'])) {
            Response::json(['error' => 'Forbidden'], 403);
        }

        $owner = $this->getProjectOwner($pdo, $projectId);
        if (!$owner) {
            Response::json(['error' => 'Project not found'], 404);
        }

        $stmt = $pdo->prepare('SELECT u.id, u.name, u.email FROM project_participants pp JOIN users u ON u.id = pp.user_id WHERE pp.project_id = :project_id ORDER BY u.name ASC');
        $stmt->execute([':project_id' => $projectId]);
        $participants = array_map(function (array $row) {
            $row['role'] = 'participant';
            return $row;
        }, $stmt->fetchAll());

        $owner['role'] = 'owner';
        $items = array_merge([$owner], $participants);

        Response::json(['items' => $items, 'owner_id' => (int) $owner['id']]);
    }

    public function addParticipant(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $projectId = (int) ($params['id'] ?? 0);
        if ($projectId <= 0) {
            Response::json(['error' => 'Invalid project id'], 422);
        }

        $pdo = Connection::get();
        $owner = $this->getProjectOwner($pdo, $projectId);
        if (!$owner) {
            Response::json(['error' => 'Project not found'], 404);
        }
        if ($current['role'] !== 'admin' && (int) $owner['id'] !== (int) $current['id']) {
            Response::json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $userId = (int) ($data['user_id'] ?? 0);
        if ($userId <= 0) {
            Response::json(['error' => 'Invalid user id'], 422);
        }
        if ((int) $owner['id'] === $userId) {
            Response::json(['error' => 'Owner already assigned'], 422);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE id = :id');
        $stmt->execute([':id' => $userId]);
        if (!$stmt->fetch()) {
            Response::json(['error' => 'User not found'], 404);
        }

        $stmt = $pdo->prepare('SELECT id FROM project_participants WHERE project_id = :project_id AND user_id = :user_id');
        $stmt->execute([
            ':project_id' => $projectId,
            ':user_id' => $userId,
        ]);
        if ($stmt->fetch()) {
            Response::json(['error' => 'User already participant'], 409);
        }

        $stmt = $pdo->prepare('INSERT INTO project_participants (project_id, user_id) VALUES (:project_id, :user_id)');
        $stmt->execute([
            ':project_id' => $projectId,
            ':user_id' => $userId,
        ]);

        Response::json(['ok' => true], 201);
    }

    public function removeParticipant(array $params): void
    {
        $auth = new AuthService();
        $current = $auth->requireUser();
        $projectId = (int) ($params['id'] ?? 0);
        $userId = (int) ($params['userId'] ?? 0);
        if ($projectId <= 0 || $userId <= 0) {
            Response::json(['error' => 'Invalid request'], 422);
        }

        $pdo = Connection::get();
        $owner = $this->getProjectOwner($pdo, $projectId);
        if (!$owner) {
            Response::json(['error' => 'Project not found'], 404);
        }
        if ($current['role'] !== 'admin' && (int) $owner['id'] !== (int) $current['id']) {
            Response::json(['error' => 'Forbidden'], 403);
        }
        if ((int) $owner['id'] === $userId) {
            Response::json(['error' => 'Cannot remove owner'], 422);
        }

        $stmt = $pdo->prepare('DELETE FROM project_participants WHERE project_id = :project_id AND user_id = :user_id');
        $stmt->execute([
            ':project_id' => $projectId,
            ':user_id' => $userId,
        ]);

        Response::json(['ok' => true]);
    }

    private function attachParticipants(\PDO $pdo, array $items): array
    {
        if (!$items) {
            return $items;
        }
        $ids = array_map(function (array $item) {
            return (int) $item['id'];
        }, $items);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare('SELECT pp.project_id, u.name, u.email, u.faculty_number FROM project_participants pp JOIN users u ON u.id = pp.user_id WHERE pp.project_id IN (' . $placeholders . ')');
        $stmt->execute($ids);
        $rows = $stmt->fetchAll();
        $map = [];
        $names = [];
        $nameLabels = [];
        foreach ($rows as $row) {
            $map[$row['project_id']][] = $row['email'];
            $names[$row['project_id']][] = $row['name'];
            $label = $row['name'];
            if (!empty($row['faculty_number'])) {
                $label .= ' (' . $row['faculty_number'] . ')';
            }
            $nameLabels[$row['project_id']][] = $label;
        }
        return array_map(function (array $item) use ($map, $names, $nameLabels) {
            $item['participants'] = $map[$item['id']] ?? [];
            $item['participants_names'] = $names[$item['id']] ?? [];
            $item['participants_labels'] = $nameLabels[$item['id']] ?? [];
            return $item;
        }, $items);
    }

    private function attachTags(\PDO $pdo, array $items): array
    {
        if (!$items) {
            return $items;
        }
        $ids = array_map(function (array $item) {
            return (int) $item['id'];
        }, $items);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare('SELECT pt.project_id, t.name FROM project_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.project_id IN (' . $placeholders . ') ORDER BY t.name ASC');
        $stmt->execute($ids);
        $rows = $stmt->fetchAll();
        $map = [];
        foreach ($rows as $row) {
            $map[$row['project_id']][] = $row['name'];
        }
        return array_map(function (array $item) use ($map) {
            $item['tags'] = $map[$item['id']] ?? [];
            return $item;
        }, $items);
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

    private function replaceParticipants(\PDO $pdo, int $projectId, array $participants, bool $createMissing = false, ?AuthService $auth = null): void
    {
        $stmt = $pdo->prepare('DELETE FROM project_participants WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $projectId]);

        foreach ($participants as $participant) {
            $email = trim((string) $participant);
            if ($email === '') {
                continue;
            }
            if ($createMissing) {
                $userId = $this->findOrCreateUserByEmail($pdo, $email, $auth ?? new AuthService());
            } else {
                $userId = $this->findUserIdByEmail($pdo, $email);
                if (!$userId) {
                    Response::json(['error' => 'Participant not found'], 422);
                }
            }
            $stmt = $pdo->prepare('INSERT INTO project_participants (project_id, user_id) VALUES (:project_id, :user_id)');
            $stmt->execute([
                ':project_id' => $projectId,
                ':user_id' => $userId,
            ]);
        }
    }

    private function findUserIdByEmail(\PDO $pdo, string $email): ?int
    {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : null;
    }

    private function findOrCreateUserByEmail(\PDO $pdo, string $email, AuthService $auth): int
    {
        $existing = $this->findUserIdByEmail($pdo, $email);
        if ($existing) {
            return $existing;
        }

        $username = trim((string) strtok($email, '@'));
        if ($username === '') {
            $username = 'user';
        }
        $password = $username;
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare('INSERT INTO users (name, email, faculty_number, password_hash, created_at) VALUES (:name, :email, :faculty_number, :hash, :created_at)');
        $stmt->execute([
            ':name' => $username,
            ':email' => $email,
            ':faculty_number' => null,
            ':hash' => $hash,
            ':created_at' => date('c'),
        ]);

        $userId = (int) $pdo->lastInsertId();
        $auth->ensureRole($pdo, $userId, 'user');

        return $userId;
    }

    private function findUserIdByEmailAndName(\PDO $pdo, string $email, string $name): ?int
    {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email AND name = :name');
        $stmt->execute([':email' => $email, ':name' => $name]);
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : null;
    }

    private function findOrCreateUserForImport(\PDO $pdo, array $payload, AuthService $auth): int
    {
        $email = trim((string) ($payload['email'] ?? ''));
        $name = trim((string) ($payload['name'] ?? ''));
        $facultyNumber = $payload['faculty_number'] ?? null;

        if ($email !== '' && $name !== '') {
            $existing = $this->findUserIdByEmailAndName($pdo, $email, $name);
            if ($existing) {
                return $existing;
            }
        }

        if ($email === '') {
            $email = 'user_' . uniqid() . '@example.com';
        }
        if ($name === '') {
            $name = 'user';
        }

        $password = $name . '_password';
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare('INSERT INTO users (name, email, faculty_number, password_hash, created_at) VALUES (:name, :email, :faculty_number, :hash, :created_at)');
        $stmt->execute([
            ':name' => $name,
            ':email' => $email,
            ':faculty_number' => $facultyNumber,
            ':hash' => $hash,
            ':created_at' => date('c'),
        ]);

        $userId = (int) $pdo->lastInsertId();
        $auth->ensureRole($pdo, $userId, 'user');

        return $userId;
    }

    private function replaceParticipantsForImport(\PDO $pdo, int $projectId, array $participants, AuthService $auth): void
    {
        $stmt = $pdo->prepare('DELETE FROM project_participants WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $projectId]);

        foreach ($participants as $participant) {
            if (is_array($participant)) {
                $userId = $this->findOrCreateUserForImport($pdo, $participant, $auth);
            } else {
                $email = trim((string) $participant);
                if ($email === '') {
                    continue;
                }
                $userId = $this->findOrCreateUserByEmail($pdo, $email, $auth);
            }

            $stmt = $pdo->prepare('INSERT INTO project_participants (project_id, user_id) VALUES (:project_id, :user_id)');
            $stmt->execute([
                ':project_id' => $projectId,
                ':user_id' => $userId,
            ]);
        }
    }

    private function replaceTags(\PDO $pdo, int $projectId, array $tags): void
    {
        $stmt = $pdo->prepare('DELETE FROM project_tags WHERE project_id = :project_id');
        $stmt->execute([':project_id' => $projectId]);

        $names = array_values(array_filter(array_map(function ($tag) {
            if (is_array($tag)) {
                return trim((string) ($tag['name'] ?? ''));
            }
            return trim((string) $tag);
        }, $tags)));

        if (!$names) {
            return;
        }

        foreach ($names as $name) {
            $tagId = $this->findOrCreateTag($pdo, $name);
            if ($tagId <= 0) {
                continue;
            }
            $stmt = $pdo->prepare('INSERT IGNORE INTO project_tags (project_id, tag_id) VALUES (:project_id, :tag_id)');
            $stmt->execute([
                ':project_id' => $projectId,
                ':tag_id' => $tagId,
            ]);
        }
    }

    private function findOrCreateTag(\PDO $pdo, string $name): int
    {
        $name = trim($name);
        if ($name === '') {
            return 0;
        }
        $stmt = $pdo->prepare('SELECT id FROM tags WHERE name = :name');
        $stmt->execute([':name' => $name]);
        $row = $stmt->fetch();
        if ($row) {
            return (int) $row['id'];
        }
        $stmt = $pdo->prepare('INSERT INTO tags (name) VALUES (:name)');
        $stmt->execute([':name' => $name]);
        return (int) $pdo->lastInsertId();
    }

    private function getProjectOwner(\PDO $pdo, int $projectId): ?array
    {
        $stmt = $pdo->prepare('SELECT u.id, u.name, u.email FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = :id');
        $stmt->execute([':id' => $projectId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private function createProjectDatabase(string $name): void
    {
        $dbName = $this->normalizeDatabaseName($name);
        if ($dbName === '') {
            Response::json(['error' => 'Invalid project name'], 422);
        }

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

        $dsn = sprintf('mysql:host=%s;port=%d;charset=%s', $host, $port, $charset);
        $pdo = new \PDO($dsn, $user, $pass, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);

        $stmt = $pdo->prepare('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = :name');
        $stmt->execute([':name' => $dbName]);
        if ($stmt->fetch()) {
            Response::json(['error' => 'Database already exists'], 409);
        }

        $collation = $charset === 'utf8mb4' ? 'utf8mb4_unicode_ci' : null;
        $safeName = str_replace('`', '``', $dbName);
        $sql = sprintf(
            'CREATE DATABASE `%s` CHARACTER SET %s%s',
            $safeName,
            $charset,
            $collation ? ' COLLATE ' . $collation : ''
        );
        $pdo->exec($sql);
    }

    private function normalizeDatabaseName(string $name): string
    {
        $normalized = preg_replace('/[^A-Za-z0-9_]+/', '_', $name);
        $normalized = trim((string) $normalized, '_');
        return strtolower($normalized);
    }

    private function dropProjectDatabase(string $name): void
    {
        $dbName = $this->normalizeDatabaseName($name);
        if ($dbName === '') {
            return;
        }

        $configPath = BASE_PATH . '/config.json';
        if (!file_exists($configPath)) {
            return;
        }
        $config = json_decode(file_get_contents($configPath), true);
        if (!is_array($config)) {
            return;
        }
        $db = $config['db'] ?? [];
        $host = $db['host'] ?? '127.0.0.1';
        $port = (int) ($db['port'] ?? 3306);
        $charset = $db['charset'] ?? 'utf8mb4';
        $user = $db['user'] ?? 'root';
        $pass = $db['pass'] ?? '';

        $dsn = sprintf('mysql:host=%s;port=%d;charset=%s', $host, $port, $charset);
        $pdo = new \PDO($dsn, $user, $pass, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);

        $safeName = str_replace('`', '``', $dbName);
        $pdo->exec(sprintf('DROP DATABASE IF EXISTS `%s`', $safeName));
    }

}
