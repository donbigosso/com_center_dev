# Donbigosso Community Center — Simple API

Instruction file for running, configuring, and extending this project.

## What this project is

A Docker-based **file transfer + user management** stack:

| Piece | Role |
|--------|------|
| **PHP API** (`api_source/`) | JSON API for auth, users, files, and admin table queries |
| **MySQL 8** | Users and media-related schema |
| **Frontend** (`frontend/`) | Browser UI for login, upload, download, rename/delete files |
| **Admin panel** (`api_source/admin/`) | Server-rendered PHP panel for admins (users table, create user, etc.) |

Public name in the UI: **Donbigosso File Transfer**.

---

## Requirements

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Optional for local frontend serving: any static server (or open `frontend/index.html` carefully — API URLs must be reachable)
- Ports free on the host:
  - **8082** → PHP/Apache
  - **3306** → MySQL

---

## Quick start

### 1. Clone / open the project

```bash
cd com_centr_simp_API
```

### 2. Create environment file

Copy or create `.env` in the project root (gitignored). Example template:

```env
MYSQL_ROOT_PASSWORD=change_me_root
MYSQL_DATABASE=bgs_com_ctr_db
MYSQL_USER=majsteradmin
MYSQL_PASSWORD=change_me_user
API_KEYS=["key1", "key2", "key3"]
UPLOAD_MAX_FILES=5
UPLOAD_MAX_SIZE_MB=256
UPLOAD_ALLOWED_EXTENSIONS=jpg,jpeg,png,pdf,txt,docx,mp3,mp4,xlsx,zip,mov
```

> **Security:** Never commit real passwords or API keys. Rotate anything that was ever shared.

### 3. Start the stack

```bash
docker compose up -d --build
```

Services:

| Service | Container | Host access |
|---------|-----------|-------------|
| PHP 8.2 + Apache | `php-server` | http://127.0.0.1:8082 |
| MySQL 8.0 | `mysql-db` | localhost:3306 |

### 4. Database init

On **first** start only, MySQL runs SQL from `db/` via `/docker-entrypoint-initdb.d`:

- Schema: `db/Donbigosso_Center.sql`

If you change init SQL after data already exists, either:

```bash
docker compose down -v   # destroys DB volume
docker compose up -d --build
```

or apply migrations manually against MySQL.

### 5. Point the frontend at the API

Edit `frontend/settings.json`:

```json
{
  "api_address": "http://127.0.0.1:8082/api_engine.php",
  "upload_address": "http://127.0.0.1:8082/upload.php",
  "api_key": "your-client-key",
  "test_setting": "optional"
}
```

Admin panel uses `api_source/admin/settings.json` (relative path to the API when served from the same host):

```json
{
  "api_address": "../api_engine.php",
  "api_key": "your-client-key"
}
```

### 6. Serve the frontend

The Docker PHP container only mounts `api_source/` as the web root. The **frontend is not inside that container** by default.

Options:

1. Serve `frontend/` with any static server, e.g.:

   ```bash
   npx serve frontend -p 5500
   ```

2. Or open via your usual local web server / Live Server, as long as `settings.json` points to port **8082**.

Admin panel (inside the API container):

- Login: http://127.0.0.1:8082/admin/login.php  
- Panel: http://127.0.0.1:8082/admin/ (requires valid session token)

Root URL http://127.0.0.1:8082/ shows a **403 Access Denied** page by design.

---

## Project layout

```
com_centr_simp_API/
├── docker-compose.yml      # php + mysql services
├── Dockerfile              # php:8.2-apache + pdo_mysql
├── uploads.ini             # PHP upload limits for Apache container
├── .env                    # secrets (not in git)
├── db/
│   └── Donbigosso_Center.sql
├── api_source/             # Document root inside php container
│   ├── api_engine.php      # Main JSON API entry
│   ├── upload.php          # Legacy/simple multipart upload
│   ├── index.php           # 403 placeholder
│   ├── classes/            # Core, DB, API, models
│   ├── admin/              # Admin PHP + JS UI
│   └── uploads/            # Stored files (ignored by git except .gitkeep)
├── frontend/               # Public file-transfer SPA
│   ├── index.html
│   ├── app.js
│   ├── settings.json
│   └── functions/
└── junk/                   # Old experiments (gitignored area / not production)
```

---

## Architecture

```
Browser (frontend/)  ──JSON/Form──►  api_engine.php  ──PDO──►  MySQL
Browser (admin/)     ──session──►    admin/*.php     ──PDO──►  MySQL
                                     └── classes/*
Files on disk: api_source/uploads/
```

- **API entry:** `api_source/api_engine.php`
- **DB connection:** host `mysql` (Docker network), credentials from env vars
- **Auth:** user **token** + **token_validity** in `users` table (cookie `session_token` on frontend; PHP `$_SESSION['token']` on admin)

---

## Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `MYSQL_ROOT_PASSWORD` | MySQL | Root password |
| `MYSQL_DATABASE` | MySQL + PHP | Database name |
| `MYSQL_USER` | MySQL + PHP | App DB user |
| `MYSQL_PASSWORD` | MySQL + PHP | App DB password |
| `API_KEYS` | PHP env | Declared API keys (JSON array string) |
| `UPLOAD_MAX_FILES` | PHP (`FileModel` / settings) | Max files per upload batch |
| `UPLOAD_MAX_SIZE_MB` | PHP | Max size per file (MB) |
| `UPLOAD_ALLOWED_EXTENSIONS` | PHP | Comma-separated extensions |

PHP also loads `uploads.ini` for Apache-level limits (`upload_max_filesize`, `post_max_size`, etc.).

---

## API reference

**Base URL (local):** `http://127.0.0.1:8082/api_engine.php`

### Response envelope

Most handlers return JSON:

```json
{
  "success": true,
  "message": "",
  "warning": "",
  "error": "",
  "data": {}
}
```

### GET requests

Pass a `request` query parameter.

| `request` | Params | Description |
|-----------|--------|-------------|
| `list_files` | — | List files in `uploads/` (name, size KB, mtime) |
| `list_users` | — | Demo stub user list (not DB-backed) |
| `download` | `file=<filename>` | Download file from `uploads/` (binary response) |

Example:

```bash
curl "http://127.0.0.1:8082/api_engine.php?request=list_files"
curl -OJ "http://127.0.0.1:8082/api_engine.php?request=download&file=example.pdf"
```

### POST requests (JSON body)

`Content-Type: application/json`. Body must include `"request": "..."`.

#### Users & auth

| `request` | Body fields | Notes |
|-----------|-------------|--------|
| `create_user` | `name`, `password` | Username: `^[a-zA-Z0-9_]{4,16}$`. Password: min 10 chars, ≥1 uppercase, ≥1 digit. Stored with `password_hash`. |
| `verify_user_password` | `name`, `password` | Returns `data.password_verification` |
| `set_user_token` | `name`, `token`, `days` | Sets session token + validity |
| `get_user_by_token` | `token` | Returns username if token valid |
| `clear_token` | `name` | Invalidates user token |
| `reset_password` | `name`, `password` | User-side password reset |
| `reset_password_by_admin` | `token`, `name`, `password` | Admin token required |
| `delete_user` | `token`, `name` | Admin token required (`delete_user_by_admin`) |
| `test` | `token` | Admin check via token |

#### Files

| `request` | Body / form | Notes |
|-----------|-------------|--------|
| `get_file_settings` | — | Returns env upload limits |
| `rename_file` | `token`, `old_filename`, `new_filename` | Token required; new name `5–50` chars (`a-zA-Z0-9._-` and spaces) |
| `delete_file` | `file_to_delete` (+ token used by client) | Deletes from `uploads/` |
| `upload_files` | multipart + `token` | Handled via `FileModel` (see upload section) |

#### Admin / DB

| `request` | Body fields | Notes |
|-----------|-------------|--------|
| `send_table_to_frontend` | `token`, `table_name`, optional `columns` | **Admin only.** Returns table as header row + value rows |

Example login-style flow (client-side pattern used by frontend):

```bash
# 1) Verify password
curl -s -X POST http://127.0.0.1:8082/api_engine.php \
  -H "Content-Type: application/json" \
  -d '{"request":"verify_user_password","name":"alice","password":"SecretPass1"}'

# 2) Set token after successful verify (client generates token)
curl -s -X POST http://127.0.0.1:8082/api_engine.php \
  -H "Content-Type: application/json" \
  -d '{"request":"set_user_token","name":"alice","token":"random-token-here","days":14}'

# 3) Resolve session
curl -s -X POST http://127.0.0.1:8082/api_engine.php \
  -H "Content-Type: application/json" \
  -d '{"request":"get_user_by_token","token":"random-token-here"}'
```

---

## File uploads

### Preferred path (app integration)

Frontend / API use **`api_engine.php`** with request `upload_files` and multipart field `files[]`, plus a valid user `token`. Logic lives in `classes/file_model.php` and reads:

- `UPLOAD_MAX_FILES`
- `UPLOAD_MAX_SIZE_MB`
- `UPLOAD_ALLOWED_EXTENSIONS`

Storage directory: `api_source/uploads/`.

### Legacy endpoint

`upload.php` is a simpler standalone uploader (hardcoded limits: 5 files, 10 MB, limited extensions). Prefer the API + env-driven path for new work.

### PHP limits (`uploads.ini`)

```ini
file_uploads = On
memory_limit = 512M
upload_max_filesize = 256M
post_max_size = 280M
max_execution_time = 600
max_input_time = 900
max_file_uploads = 10
```

---

## Database schema (summary)

Defined in `db/Donbigosso_Center.sql`:

| Table | Purpose |
|-------|---------|
| `users` | Auth: name, hashed password, recovery fields, `is_admin`, `token`, `token_validity` |
| `posts` | User posts |
| `files` | File metadata records |
| `media_items` | Media typed PIC / VID / YT |
| `media_collections` | Galleries/collections |
| `collection_owners` | User ↔ collection access |
| `media_in_collection` | Items in collections |
| `media_in_post` | Items attached to posts |

**Note:** Current file-transfer UI primarily uses the **filesystem** under `uploads/`. Media tables support a broader “community center” data model.

### Create an admin user

After stack is up, insert a user (password must be a PHP `password_hash` of your password) and set `is_admin = 1`, e.g. via MySQL client:

```bash
docker exec -it mysql-db mysql -u majsteradmin -p bgs_com_ctr_db
```

Or create via API `create_user`, then update:

```sql
UPDATE users SET is_admin = 1 WHERE name = 'your_username';
```

---

## Frontend notes

- Entry: `frontend/index.html` + `frontend/app.js`
- Shared helpers under `frontend/functions/` (login, cookies, tables, upload, gallery, etc.)
- Session cookie: `session_token`
- UI toggles logged vs unlogged sections (Bootstrap 5)
- Galleries sub-app: `frontend/galleries/`

---

## Admin panel notes

- PHP session required (`login.php` / `logout.php`)
- Protected by `Core::redirect_to_login_screen()` (valid DB token in session)
- Can show users table, create user, and other admin tiles
- Calls same `api_engine.php` using admin `settings.json`

---

## Common Docker commands

```bash
# Start / rebuild
docker compose up -d --build

# Logs
docker compose logs -f php
docker compose logs -f mysql

# Stop
docker compose down

# Stop and wipe database volume
docker compose down -v

# Shell into PHP container
docker exec -it php-server bash

# MySQL CLI
docker exec -it mysql-db mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"
```

---

## Development tips

1. **Hot reload API code:** `./api_source` is bind-mounted into the PHP container — edit PHP/JS under `api_source/` without rebuilding (restart only if env or image changes).
2. **Env changes:** update `.env`, then `docker compose up -d` (recreate containers if needed).
3. **CORS:** `api_engine.php` and `upload.php` send `Access-Control-Allow-Origin: *` for browser clients on other ports.
4. **`junk/`:** old prototypes; not part of the running path. Prefer `api_source/classes/*`.
5. **PUT / DELETE / PATCH:** not implemented on the API router; use POST actions instead.
6. **Username / password rules** (create user):
   - Username: 4–16 chars, letters, digits, underscore
   - Password: ≥10 chars, at least one uppercase letter and one digit

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| DB connection failed | MySQL healthy? Env vars match? PHP uses host name `mysql` |
| Empty database | Volume already existed before SQL was added → `down -v` and re-init |
| Upload fails | File size/extension; `uploads.ini`; folder writable; valid user token |
| Frontend cannot reach API | `frontend/settings.json` URL/port; browser CORS; container on 8082 |
| Admin always redirects to login | No valid `$_SESSION['token']` or expired `token_validity` |
| Port in use | Change host ports in `docker-compose.yml` (`8082:80`, `3306:3306`) |

---

## Production checklist (minimum)

- [ ] Strong unique passwords in `.env`
- [ ] Do not expose MySQL `3306` publicly
- [ ] Restrict CORS origins (currently `*`)
- [ ] Serve frontend and API over HTTPS
- [ ] Harden file download/rename/delete (auth on all mutating ops)
- [ ] Back up `db_data` volume and `api_source/uploads/`
- [ ] Remove or lock demo endpoints (`list_users`, loose upload.php)
- [ ] Align client `api_key` with server-side key validation if you enforce `API_KEYS`

---

## License / ownership

Private project (Donbigosso). Adjust this section if you publish or share the repository.
