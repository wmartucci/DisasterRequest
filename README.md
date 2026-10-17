# DisasterRequest

DisasterRequest is a community incident-reporting application. Community
members can report incidents such as floods, fires, fallen trees, and power
outages. Coordinators can browse reports, update their status, and remove
reports that are no longer needed.

The application consists of:

- A FastAPI backend that exposes the incident-reporting API.
- A PostgreSQL database with the PostGIS extension for geographic locations.
- A vanilla JavaScript frontend for browsing, creating, updating, and
  deleting incident reports.

## Features

- Browse incident reports and reporter contact information.
- Search and filter reports by report ID, name, city, description, status, and
  incident type.
- Create an incident report for an existing community member.
- Update an incident report through the following statuses:
  `Pending Assistance`, `Help Requested`, `Unit in Response`, and `Resolved`.
- Delete an incident report after confirmation.
- Retrieve community members and volunteers through the API.
- Store report coordinates as PostGIS `POINT` values using SRID 4326.
- Use FastAPI's automatically generated Swagger UI and ReDoc documentation.

## Technology stack

- Python 3.10 or newer
- FastAPI
- Uvicorn
- PostgreSQL
- PostGIS
- `psycopg2-binary`
- `python-dotenv`
- HTML, CSS, and browser-native JavaScript modules

## Project structure

```text
.
├── backend/
│   ├── database.py          # PostgreSQL connection and query functions
│   ├── db_tests.py          # Database smoke-test helpers
│   └── main.py              # FastAPI application and API routes
├── data/
│   └── IncidentReports.geojson
├── frontend/
│   ├── api.js               # Frontend API client
│   ├── index.html           # Application page
│   ├── main.js              # Frontend behavior and rendering
│   └── style.css            # Application styles
├── sql/
│   ├── schema.sql           # PostGIS schema and constraints
│   └── seed.sql             # Sample data
├── requirements.txt
└── README.md
```

## Prerequisites

Install the following before starting:

1. Python 3.10 or newer.
2. PostgreSQL.
3. PostGIS enabled for the database.
4. A shell capable of running the commands below.

The backend only needs a PostgreSQL connection URL. The database can be
local, hosted, or provided by a service such as Neon, as long as PostGIS is
available.

## Setup

### 1. Create a virtual environment

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

On Windows PowerShell, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

### 2. Install Python dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 3. Configure the database connection

Create a `.env` or `.env.local` file in the repository root. The application
reads `DATABASE_URL` from these files, with `.env.local` taking precedence.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

Do not commit either environment file. They are already excluded by
`.gitignore`.

### 4. Initialize PostgreSQL and PostGIS

Create a PostgreSQL database, then run the schema and optional sample data
scripts:

```bash
psql "$DATABASE_URL" -f sql/schema.sql
psql "$DATABASE_URL" -f sql/seed.sql
```

The schema creates the PostGIS extension and the tables used for community
members, incident reports, response coordinators, response units, help
requests, volunteers, resources, and posts.

If your PostgreSQL provider does not allow `CREATE EXTENSION` from a script,
enable PostGIS through the provider's dashboard or run the following as a
database administrator before applying the schema:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## Running the application

Start the backend from the repository root:

```bash
uvicorn backend.main:app --reload
```

The API is available at <http://localhost:8000>.

Serve the frontend from a second terminal. A static HTTP server is required
because the frontend uses JavaScript modules:

```bash
cd frontend
python -m http.server 5500
```

Open <http://localhost:5500> in a browser. The frontend is configured to call
the API at `http://localhost:8000`.

The backend permits requests from the local development origins
`localhost:5500`, `127.0.0.1:5500`, `localhost:3000`, and
`127.0.0.1:3000`.

## API documentation

When the backend is running, interactive API documentation is available at:

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>
- OpenAPI schema: <http://localhost:8000/openapi.json>

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/incident-reports` | Create an incident report |
| `GET` | `/api/incident-reports` | List all incident reports |
| `GET` | `/api/incident-reports?report_id={id}` | Find a report by ID |
| `PATCH` | `/api/incident-reports/{id}` | Update a report's status |
| `DELETE` | `/api/incident-reports/{id}` | Delete a report |
| `GET` | `/api/community-members` | List community members |
| `GET` | `/api/community-members?first={name}&last={name}` | Search community members |
| `GET` | `/api/volunteers` | List volunteers |

For a new incident report, the request body must include `member_id`, `type`,
`address`, `city`, `state`, `description`, `status`, `latitude`, and
`longitude`. `image_url` is optional.

Example:

```bash
curl -X POST http://localhost:8000/api/incident-reports \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "type": "Flood",
    "address": "5 Big Level Dr",
    "city": "Asheville",
    "state": "NC",
    "description": "Water is entering the lower level.",
    "status": "Pending Assistance",
    "latitude": 35.58,
    "longitude": -82.56
  }'
```

## Database smoke tests

The helper tests in `backend/db_tests.py` use the configured database and
assume that the schema and sample data have already been loaded. Run them
from the `backend` directory:

```bash
cd backend
python db_tests.py
```

These tests perform database operations when enabled in the file, so use a
development database rather than a production database.

## Troubleshooting

### `DATABASE_URL is not configured`

Verify that `.env` or `.env.local` exists in the repository root and contains
a valid `DATABASE_URL`. Start Uvicorn from the repository root so the
application can load the environment files.

### The frontend reports that the API is unavailable

Confirm that:

1. Uvicorn is running on port `8000`.
2. The frontend is being served over HTTP on port `5500` rather than opened
   directly as a `file://` URL.
3. The database is reachable and the schema has been applied.
4. The browser origin matches one of the origins allowed by the backend CORS
   configuration.

### Database errors during startup or requests

Check that the connection URL is valid, the database is running, PostGIS is
enabled, and `sql/schema.sql` was applied before `sql/seed.sql`.

## License

No license has been specified for this project.