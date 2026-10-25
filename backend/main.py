from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pwdlib import PasswordHash
from . import database as db

app = FastAPI(title="Disaster Request API", version="1.0.0")
password_hasher = PasswordHash.recommended()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# --------- Data model classes ----------
class IncidentReport(BaseModel):
    member_id: int
    type: str
    address: str
    city: str
    state: str
    image_url: str | None = None
    description: str
    status: str
    latitude: float
    longitude: float


class StatusUpdate(BaseModel):
    new_status: str

class User(BaseModel):
    first_name: str
    last_name: str
    role: str
    user_name: str
    password: str

class UserLogin(User):
    first_name: str | None = None
    last_name: str | None = None
    role: str | None = None

# --------- CREATE endpoints ----------
@app.post("/api/incident-reports", status_code=201)
def create_incident_report(report: IncidentReport) -> dict:
    columns, rows = db.create_incident_report(**report.model_dump())
    return dict(zip(columns, rows[0]))


# --------- READ endpoints ----------
@app.get("/api/volunteers")
def volunteers() -> list[dict]:
    return db.get_volunteers()


@app.get("/api/community-members")
def community_members(
    first: str | None = Query(default=None, min_length=1),
    last: str | None = Query(default=None, min_length=1),
) -> list[dict]:
    if first is None and last is None:
        return db.get_community_members()
    return db.search_community_members_by_name(first or "", last or "")


@app.get("/api/incident-reports")
def incident_reports(report_id: int | None = Query(default=None, ge=1)) -> list[dict]:
    if report_id is None:
        return db.get_incident_reports()
    return db.search_incident_reports_by_id(report_id)


# --------- UPDATE endpoints ----------
@app.patch("/api/incident-reports/{report_id}")
def update_incident_report_status(report_id: int, update: StatusUpdate) -> dict:
    result = db.update_incident_report_status(report_id, update.new_status)
    if result == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"report_id": report_id, "status": update.new_status}


# --------- DELETE endpoints ----------
@app.delete("/api/incident-reports/{report_id}")
def delete_incident_report(report_id: int) -> dict:
    result = db.delete_incident_report(report_id)
    if result == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"report_id": report_id, "deleted": True}


# --------- Helper functions ----------
@app.exception_handler(RuntimeError)
async def database_configuration_error(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})

@app.exception_handler(db.DuplicateValueError)
async def database_configuration_error(_: Request, exc: db.DuplicateValueError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})

@app.exception_handler(db.InvalidTypeError)
async def database_configuration_error(_: Request, exc: db.InvalidTypeError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})

# -------- Authentication functions ---------

# Create new user
@app.post("/api/signup")
def create_user(user_details: User):
    hashed_password = password_hasher.hash(user_details.password)
    columns, rows = db.create_user(user_details.first_name, user_details.last_name, 
                                   user_details.role, user_details.user_name, hashed_password)
    new_user_details = dict(zip(columns, rows[0]))
    del new_user_details["password_hash"]
    return new_user_details

# Authenticate user
@app.post("/api/login")
def login_user(credentials: UserLogin):
    # Get hashed password from database
    hash_details = db.get_password_hash(credentials.user_name)
    if hash_details:
        stored_hash = hash_details["password_hash"]
        is_valid = password_hasher.verify(credentials.password, stored_hash)
        if is_valid:
            return {"message": f"Authentication successful",
                    "role": f"{hash_details['role']}"}
        else:
            raise HTTPException(status_code=401, detail=f"Invalid password")
    else:
        raise HTTPException(status_code=401, detail=f"Invalid username")