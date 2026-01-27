# DB Dashboard (New)

Fresh PHP + HTML/CSS/JS implementation for a database setup & management dashboard.

## Run locally

1) Initialize the MySQL database (XAMPP):

- Import `database/init.sql` in phpMyAdmin, or run:

```powershell
mysql -u root -p < database/init.sql
```

2) Start the PHP built-in server:

```powershell
php -S localhost:8080 -t public
```

3) Open the UI:
- http://localhost:8080/index.html

## Notes
- MySQL is used for metadata (users, projects, templates, actions, backups).
- Connection settings are in `config.json`.
- Seed users from `database/init.sql`:
  - `admin@example.com` / `password`
  - `demo@example.com` / `password`

## Default flow
- Register a user (first user becomes admin).
- Add servers/templates.
- Create or bulk-import projects.
- Generate actions/backups for a project.
