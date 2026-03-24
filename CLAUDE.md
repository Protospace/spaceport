# Noiseport (Spaceport)

Member portal for Noisebridge hackerspace. Tracks membership, courses, training, access cards, storage, and community resources. Originally built for Calgary Protospace.

## Tech Stack

- **Backend**: Django 3.1 + Django REST Framework (`/apiserver`), SQLite, memcached
- **Frontend**: React 16 (CRA) + Semantic UI React (`/webclient`), Yarn
- **Auth**: Token-based (rest_auth), OIDC provider
- **Other services**: Auth server (`/authserver`), LDAP server (`/ldapserver`)

## Development

```bash
# Backend
cd apiserver
source env/bin/activate
DEBUG=true BINDALL=true python manage.py runserver 0.0.0.0:8000

# Frontend
cd webclient
HOST=0.0.0.0 yarn start  # port 3000
```

First registered user is auto-granted admin.

### Docker (recommended)

```bash
docker compose up              # starts apiserver :8000, webclient :3000, memcached
docker compose up --build      # rebuild after dependency changes
docker compose --profile auth up   # include authserver (needs external MediaWiki/Discourse)
docker compose --profile ldap up   # include ldapserver (needs external AD)
```

Frontend auto-detects the API at `localhost:8000` via port detection in `webclient/src/utils.js`.

## Testing

```bash
python manage.py test apiserver.api    # backend
cd webclient && yarn test              # frontend
```

## Code Conventions

- Tabs for indentation (4 spaces for Python per .editorconfig)
- Single quotes in JavaScript (.prettierrc)
- Backend: ViewSets + serializers + custom permissions (IsObjOwnerOrAdmin, IsAdmin, etc.)
- Frontend: mix of class and functional components, localStorage for state, `requester()` utility for API calls
- Trailing slashes required on API URLs
- Timezone: stored UTC, displayed America/Edmonton. Use `today_alberta_tz()` / `now_alberta_tz()`

## Key Directories

- `apiserver/api/models.py` — all models (Member, Transaction, Card, Course, Session, Training, etc.)
- `apiserver/api/views.py` — all ViewSets
- `apiserver/api/serializers.py` — DRF serializers
- `apiserver/apiserver/urls.py` — URL routing
- `webclient/src/` — React components (Home, Members, Training, Courses, Charts, etc.)
- `scripts/` — migration and management scripts
- `docs/` — project documentation

## Management Commands (Cron)

- `run_minutely` — server checks, shopping/maintenance lists
- `run_hourly` — membership status updates, email notifications
- `run_daily` — backups, stats calculation
- `run_weekly` — report generation
