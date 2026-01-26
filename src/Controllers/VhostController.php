<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Db\Connection;
use App\Http\Response;

final class VhostController
{
    public function list(): void
    {
        (new AuthService())->requireUser();
        $pdo = Connection::get();
        $stmt = $pdo->query('SELECT * FROM vhosts ORDER BY id DESC');
        Response::json(['items' => $stmt->fetchAll()]);
    }

    public function create(): void
    {
        (new AuthService())->requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['project_id']) || empty($data['host'])) {
            Response::json(['error' => 'Missing fields'], 422);
        }

        $pdo = Connection::get();
        $stmt = $pdo->prepare('INSERT INTO vhosts (project_id, host, doc_root, status, created_at) VALUES (:project_id, :host, :doc_root, :status, :created_at)');
        $stmt->execute([
            ':project_id' => (int) $data['project_id'],
            ':host' => trim($data['host']),
            ':doc_root' => trim($data['doc_root'] ?? ''),
            ':status' => trim($data['status'] ?? 'active'),
            ':created_at' => date('c'),
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId()], 201);
    }
}
