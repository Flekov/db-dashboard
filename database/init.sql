CREATE DATABASE IF NOT EXISTS db_dashboard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_dashboard;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS backups;
DROP TABLE IF EXISTS actions;
DROP TABLE IF EXISTS vhosts;
DROP TABLE IF EXISTS project_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS project_participants;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS servers;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  faculty_number VARCHAR(64),
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(190) NOT NULL UNIQUE,
  short_name VARCHAR(120),
  version VARCHAR(64),
  type VARCHAR(64),
  status VARCHAR(32) DEFAULT 'active',
  owner_id INT NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  db_type VARCHAR(64) NOT NULL,
  db_version VARCHAR(64),
  stack_version VARCHAR(64),
  notes TEXT,
  body_json TEXT,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  locked_at DATETIME NULL,
  last_run_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB;

CREATE TABLE servers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  host VARCHAR(190) NOT NULL,
  port INT NOT NULL,
  type VARCHAR(64) NOT NULL,
  version VARCHAR(64),
  db_user VARCHAR(64),
  db_pass VARCHAR(255),
  charset VARCHAR(32),
  created_at DATETIME NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB;

CREATE TABLE tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE project_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  tag_id INT NOT NULL,
  UNIQUE KEY project_tag_unique (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
) ENGINE=InnoDB;

CREATE TABLE project_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  payload_json TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB;

CREATE TABLE backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  backup_type VARCHAR(32) NOT NULL,
  location VARCHAR(255),
  version_label VARCHAR(64),
  created_at DATETIME NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB;

CREATE TABLE vhosts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  host VARCHAR(190) NOT NULL,
  doc_root VARCHAR(255),
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB;

INSERT INTO roles (name) VALUES
  ('admin'),
  ('user');

INSERT INTO users (name, email, faculty_number, password_hash, created_at) VALUES
  ('Admin User', 'admin@example.com', 'FN-0001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NOW()),
  ('Demo User', 'demo@example.com', 'FN-0002', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NOW());

INSERT INTO user_roles (user_id, role_id) VALUES
  (1, 1),
  (2, 2);

INSERT INTO sessions (user_id, token, expires_at) VALUES
  (1, 'testtoken_admin_001', DATE_ADD(NOW(), INTERVAL 7 DAY)),
  (2, 'testtoken_demo_001', DATE_ADD(NOW(), INTERVAL 7 DAY));

INSERT INTO projects (code, name, short_name, version, type, status, owner_id, created_at) VALUES
  ('7777', 'MyWeb App', 'myweb', 'v2', 'mysql', 'active', 1, NOW()),
  ('8888', 'Portal Site', 'portal', 'v1', 'mysql', 'active', 2, NOW());

INSERT INTO templates (project_id, name, db_type, db_version, stack_version, notes, body_json, created_at) VALUES
  (1, 'MySQL 8 Base', 'mysql', '8.0', 'xampp-8.2', 'Default starter template', '{\"create_user\":\"CREATE USER ...\",\"create_db\":\"CREATE DATABASE ...\",\"config_files\":[\"config_db.php\"]}', NOW()),
  (2, 'MySQL 5 Legacy', 'mysql', '5.7', 'xampp-7.4', 'Legacy support', '{\"create_user\":\"CREATE USER ...\",\"create_db\":\"CREATE DATABASE ...\",\"config_files\":[\"config_db.php\"]}', NOW());

INSERT INTO tags (name) VALUES
  ('projects-2025'),
  ('mysql'),
  ('legacy'),
  ('portal');

INSERT INTO project_tags (project_id, tag_id) VALUES
  (1, 1),
  (1, 2),
  (2, 1),
  (2, 2),
  (2, 3),
  (2, 4);

INSERT INTO servers (project_id, name, host, port, type, version, db_user, db_pass, charset, created_at) VALUES
  (1, 'db_dashboard', '127.0.0.1', 3306, 'mysql', '8.0', 'root', 'changeme', 'utf8mb4', NOW()),
  (2, 'db_dashboard', 'localhost', 3306, 'mysql', '8.0', 'root', 'changeme', 'utf8mb4', NOW());

INSERT INTO project_participants (project_id, user_id) VALUES
  (1, 1),
  (1, 2);

INSERT INTO actions (project_id, action_type, status, payload_json, created_at) VALUES
  (1, 'create_db', 'done', '{\"db\":\"myweb_v2\"}', NOW()),
  (2, 'migrate', 'queued', '{\"from\":\"v1\",\"to\":\"v2\"}', NOW());

INSERT INTO backups (project_id, backup_type, location, version_label, created_at) VALUES
  (1, 'sql', 'C:/backups/myweb_v2.sql', 'v2.0.1', NOW()),
  (2, 'code', 'C:/backups/portal_v1.zip', 'v1.0.0', NOW());

INSERT INTO vhosts (project_id, host, doc_root, status, created_at) VALUES
  (1, 'myweb.local', 'C:/xampp/htdocs/myweb', 'active', NOW()),
  (2, 'portal.local', 'C:/xampp/htdocs/portal', 'active', NOW());
