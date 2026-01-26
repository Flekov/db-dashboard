# DB Dashboard (New)

Fresh PHP + HTML/CSS/JS implementation for a database setup & management dashboard.

## Run locally

1) Start the PHP built-in server:

```powershell
php -S localhost:8080 -t public
```

2) Open the UI:
- http://localhost:8080/index.html

## Notes
- SQLite is used only for metadata (users, projects, templates, actions, backups). It auto-initializes on first run.
- This is a clean rewrite in `new/` and does not depend on the old codebase.

## Default flow
- Register a user (first user becomes admin).
- Add servers/templates.
- Create or bulk-import projects.
- Generate actions/backups for a project.
