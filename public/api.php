<?php
require __DIR__ . '/../src/bootstrap.php';

use App\Http\Router;
use App\Http\Response;
use App\Controllers\AuthController;
use App\Controllers\ProjectController;
use App\Controllers\TemplateController;
use App\Controllers\ServerController;
use App\Controllers\ActionController;
use App\Controllers\BackupController;
use App\Controllers\VhostController;
use App\Controllers\UserController;
use App\Controllers\TagController;

$router = new Router();

$router->add('POST', '/auth/register', [AuthController::class, 'register']);
$router->add('POST', '/auth/login', [AuthController::class, 'login']);
$router->add('POST', '/auth/logout', [AuthController::class, 'logout']);
$router->add('GET', '/auth/me', [AuthController::class, 'me']);

$router->add('GET', '/servers', [ServerController::class, 'list']);
$router->add('POST', '/servers', [ServerController::class, 'create']);
$router->add('PUT', '/servers/{id}', [ServerController::class, 'update']);
$router->add('DELETE', '/servers/{id}', [ServerController::class, 'delete']);

$router->add('GET', '/templates', [TemplateController::class, 'list']);
$router->add('POST', '/templates', [TemplateController::class, 'create']);
$router->add('PUT', '/templates/{id}', [TemplateController::class, 'update']);
$router->add('DELETE', '/templates/{id}', [TemplateController::class, 'delete']);

$router->add('GET', '/projects', [ProjectController::class, 'list']);
$router->add('POST', '/projects', [ProjectController::class, 'create']);
$router->add('POST', '/projects/import', [ProjectController::class, 'import']);
$router->add('GET', '/projects/{id}', [ProjectController::class, 'show']);
$router->add('PUT', '/projects/{id}', [ProjectController::class, 'update']);
$router->add('DELETE', '/projects/{id}', [ProjectController::class, 'delete']);
$router->add('GET', '/projects/{id}/participants', [ProjectController::class, 'participants']);
$router->add('POST', '/projects/{id}/participants', [ProjectController::class, 'addParticipant']);
$router->add('DELETE', '/projects/{id}/participants/{userId}', [ProjectController::class, 'removeParticipant']);

$router->add('GET', '/projects/{id}/actions', [ActionController::class, 'list']);
$router->add('POST', '/projects/{id}/actions', [ActionController::class, 'create']);

$router->add('GET', '/projects/{id}/backups', [BackupController::class, 'list']);
$router->add('POST', '/projects/{id}/backups', [BackupController::class, 'create']);
$router->add('PUT', '/projects/{id}/backups/{backupId}', [BackupController::class, 'update']);
$router->add('DELETE', '/projects/{id}/backups/{backupId}', [BackupController::class, 'delete']);
$router->add('GET', '/backups', [BackupController::class, 'list']);

$router->add('GET', '/vhosts', [VhostController::class, 'list']);
$router->add('POST', '/vhosts', [VhostController::class, 'create']);

$router->add('PUT', '/users/{id}', [UserController::class, 'update']);
$router->add('DELETE', '/users/{id}', [UserController::class, 'delete']);
$router->add('GET', '/users', [UserController::class, 'list']);
$router->add('GET', '/tags', [TagController::class, 'list']);
$router->add('POST', '/tags', [TagController::class, 'create']);
$router->add('PUT', '/tags/{id}', [TagController::class, 'update']);
$router->add('DELETE', '/tags/{id}', [TagController::class, 'delete']);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = $_SERVER['PATH_INFO'] ?? '/';

try {
    $router->dispatch($method, $path);
} catch (Throwable $e) {
    Response::json(['error' => 'Server error', 'detail' => $e->getMessage()], 500);
}
