# Donbigosso File Transfer — Simple API

Docker-based **file transfer** and **user management** stack: PHP 8.2 API, MySQL 8, browser frontend, and admin panel.

For full API reference, schema details, and production notes, see **[INSTRUCTIONS.md](./INSTRUCTIONS.md)**.

---

## Stack

| Component | Technology | Port (local) |
|-----------|------------|--------------|
| API + admin | PHP 8.2 + Apache | [http://127.0.0.1:8082](http://127.0.0.1:8082) |
| Database | MySQL 8.0 | `localhost:3306` |
| Public UI | Static frontend (`frontend/`) | Serve separately |

---

## Quick start

### Prerequisites

- Docker & Docker Compose
- Free host ports **8082** and **3306**

### 1. Environment

Create a `.env` file in the project root (see template below). This file is gitignored.

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

### 2. Start services

```bash
docker compose up -d --build
```

| Service | Container | Notes |
|---------|-----------|--------|
| PHP API | `php-server` | Mounts `api_source/` → `/var/www/html` |
| MySQL | `mysql-db` | Init SQL from `db/` on first start |

### 3. Configure the frontend

Edit `frontend/settings.json` so it points at your API:

```json
{
  "api_address": "http://127.0.0.1:8082/api_engine.php",
  "upload_address": "http://127.0.0.1:8082/upload.php",
  "api_key": "your-client-key"
}
```

### 4. Open the apps

| App | URL / path |
|-----|------------|
| API engine | http://127.0.0.1:8082/api_engine.php |
| Admin login | http://127.0.0.1:8082/admin/login.php |
| Public frontend | Serve `frontend/` (e.g. `npx serve frontend -p 5500`) |

The API document root (`/`) intentionally returns **403 Access Denied**.

---

## Project structure

```
├── docker-compose.yml     # php + mysql
├── Dockerfile             # php:8.2-apache + pdo_mysql
├── uploads.ini            # PHP upload limits
├── .env                   # Secrets (not committed)
├── db/                    # MySQL init SQL
├── api_source/            # API, admin panel, uploads/
│   ├── api_engine.php     # Main JSON API
│   ├── classes/           # Core, DB, models
│   └── admin/             # Admin UI
├── frontend/              # Public file-transfer UI
├── INSTRUCTIONS.md        # Full developer guide
└── README.md              # This file
```

---

## API at a glance

**Base URL:** `http://127.0.0.1:8082/api_engine.php`

Standard JSON response:

```json
{
  "success": true,
  "message": "",
  "warning": "",
  "error": "",
  "data": {}
}
```

| Method | Example | Purpose |
|--------|---------|---------|
| GET | `?request=list_files` | List files in `uploads/` |
| GET | `?request=download&file=name.ext` | Download a file |
| POST | `{"request":"create_user","name":"...","password":"..."}` | Register user |
| POST | `{"request":"verify_user_password",...}` | Check password |
| POST | `{"request":"set_user_token",...}` | Issue session token |
| POST | `{"request":"get_user_by_token",...}` | Resolve session |
| POST | `{"request":"rename_file" \| "delete_file" \| "upload_files",...}` | File ops |

Auth uses a **token** and **token_validity** stored on the `users` table. Full request list and body fields: [INSTRUCTIONS.md](./INSTRUCTIONS.md#api-reference).

---

## Useful commands

```bash
docker compose up -d --build   # start / rebuild
docker compose logs -f php     # API logs
docker compose down            # stop
docker compose down -v         # stop + wipe DB volume
```

---

## Username & password rules

When creating users via the API:

- **Username:** 4–16 characters, `a-zA-Z0-9_`
- **Password:** at least 10 characters, one uppercase letter, one digit

---

## Documentation

| Doc | Contents |
|-----|----------|
| **[INSTRUCTIONS.md](./INSTRUCTIONS.md)** | Architecture, env vars, full API, uploads, schema, admin, troubleshooting, production checklist |

---

## License

Private project (Donbigosso).
