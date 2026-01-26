<?php

namespace App\Http;

use App\Http\Response;

final class Router
{
    private array $routes = [];

    public function add(string $method, string $path, callable|array $handler): void
    {
        $pattern = preg_replace('#\{([^/]+)\}#', '(?P<$1>[^/]+)', $path);
        $pattern = '#^' . $pattern . '$#';

        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'handler' => $handler,
        ];
    }

    public function dispatch(string $method, string $path): void
    {
        $method = strtoupper($method);

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            if (preg_match($route['pattern'], $path, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                $handler = $route['handler'];

                if (is_array($handler)) {
                    $class = $handler[0];
                    $methodName = $handler[1];
                    $instance = new $class();
                    $instance->$methodName($params);
                } else {
                    $handler($params);
                }
                return;
            }
        }

        Response::json(['error' => 'Not found'], 404);
    }
}
