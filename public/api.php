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

$router = new Router();

$router->add('POST', '/auth/register', [AuthController::class, 'register']);
$router->add('POST', '/auth/login', [AuthController::class, 'login']);
$router->add('POST', '/auth/logout', [AuthController::class, 'logout']);
$router->add('GET', '/auth/me', [AuthController::class, 'me']);

$router->add('GET', '/servers', [ServerController::class, 'list']);
$router->add('POST', '/servers', [ServerController::class, 'create']);

$router->add('GET', '/templates', [TemplateController::class, 'list']);
$router->add('POST', '/templates', [TemplateController::class, 'create']);

$router->add('GET', '/projects', [ProjectController::class, 'list']);
$router->add('POST', '/projects', [ProjectController::class, 'create']);
$router->add('POST', '/projects/import', [ProjectController::class, 'import']);
$router->add('GET', '/projects/{id}', [ProjectController::class, 'show']);

$router->add('GET', '/projects/{id}/actions', [ActionController::class, 'list']);
$router->add('POST', '/projects/{id}/actions', [ActionController::class, 'create']);

$router->add('GET', '/projects/{id}/backups', [BackupController::class, 'list']);
$router->add('POST', '/projects/{id}/backups', [BackupController::class, 'create']);

$router->add('GET', '/vhosts', [VhostController::class, 'list']);
$router->add('POST', '/vhosts', [VhostController::class, 'create']);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = $_SERVER['PATH_INFO'] ?? '/';

try {
    $router->dispatch($method, $path);
} catch (Throwable $e) {
    Response::json(['error' => 'Server error', 'detail' => $e->getMessage()], 500);
}
