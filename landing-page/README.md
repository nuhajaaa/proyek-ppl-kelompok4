# Anindita Creative

Static frontend and a small Node.js server for the landing page and admin editor.

## Run locally

Node.js 18 or newer is required. Set a private admin password in the environment; it is never stored in the repository.

## Admin login

- Username: `admin` by default. Override it with `ADMIN_USERNAME` if needed.
- Password: the value assigned to `ADMIN_PASSWORD` when starting the server. There is no password stored in the project; use at least 16 characters.

PowerShell:

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "set-a-private-password-with-at-least-16-characters"
node .\server.js
```

Open `http://127.0.0.1:4173/` for the landing page and `http://127.0.0.1:4173/admin` for the admin panel. The server writes public content changes to `content.json`. Admin sessions expire after eight hours and are held in server memory, so restarting the server logs the admin out.

For production, run behind HTTPS, set `NODE_ENV=production`, and use a strong password provided by the deployment secret manager. The built-in in-memory session and login rate limit are intended for a small single-admin deployment; use the application's production authentication/session infrastructure for a larger or multi-admin service.
