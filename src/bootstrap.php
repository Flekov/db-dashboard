<?php

declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));

date_default_timezone_set('Europe/Sofia');

spl_autoload_register(function (string $class) {
    $prefix = 'App\\';
    if (str_starts_with($class, $prefix)) {
        $relative = substr($class, strlen($prefix));
        $path = BASE_PATH . '/src/' . str_replace('\\', '/', $relative) . '.php';
        if (file_exists($path)) {
            require $path;
        }
    }
});
