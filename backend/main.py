from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import database

app = FastAPI(title="Disaster Request API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/volunteers")
def volunteers() -> list[dict]:
    return database.get_volunteers()


@app.get("/api/community-members")
def community_members(
    first: str | None = Query(default=None, min_length=1),
    last: str | None = Query(default=None, min_length=1),
) -> list[dict]:
    if first is None and last is None:
        return database.get_community_members()
    return database.search_community_members_by_name(first or "", last or "")


@app.get("/api/incident-reports")
def incident_reports(report_id: int | None = Query(default=None, ge=1)) -> list[dict]:
    if report_id is None:
        return database.get_incident_reports()
    return database.search_incident_reports_by_id(report_id)


@app.exception_handler(RuntimeError)
async def database_configuration_error(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})