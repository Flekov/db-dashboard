<?php

namespace App\Controllers;

use App\Auth\AuthService;
use App\Http\Response;

final class AuthController
{
    private AuthService $auth;

    public function __construct()
    {
        $this->auth = new AuthService();
    }

    public function register(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $result = $this->auth->register($data);
        Response::json($result, 201);
    }

    public function login(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $result = $this->auth->login($data);
        Response::json($result);
    }

    public function logout(): void
    {
        $user = $this->auth->requireUser();
        $this->auth->logout($user['token']);
        Response::json(['ok' => true]);
    }

    public function me(): void
    {
        $user = $this->auth->requireUser();
        Response::json([
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ]);
    }
}
