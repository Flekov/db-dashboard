# DB Dashboard (final)
1) Start the PHP built-in server:

php -S localhost:80 -t public

2) Open the UI:
- http://localhost:80/index.html



## Notes
- MySQL is used for metadata (users, projects, templates, actions, backups).
- Connection settings are in `config.json`.
- Seed users from `database/init.sql`:
  - `admin@example.com` / `password`
  - `demo@example.com` / `password`

