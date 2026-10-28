from fastapi import FastAPI, HTTPException, Query, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pwdlib import PasswordHash
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
from . import database as db
import os

load_dotenv()


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

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET_KEY"],
    session_cookie="session",
    max_age=8*60*60,
    same_site="lax",
    https_only=False
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

# --------- Dependencies -------------
def get_current_user(request: Request):
    user_id = request.session.get("user_id")
    role = request.session.get("role")

    if user_id is None or role is None:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    return {"user_id": user_id, "role": role}

def require_roles(*allowed_roles):
    def check_role(user = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Forbidden"
            )
        return user
    return check_role

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
def update_incident_report_status(
    report_id: int,
    update: StatusUpdate,
    user=Depends(require_roles("Response Coordinator")),
) -> dict:
    # Required role: Response Coordinator, Responder
    result = db.update_incident_report_status(report_id, update.new_status)
    if result == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"report_id": report_id, "status": update.new_status}


# --------- DELETE endpoints ----------
@app.delete("/api/incident-reports/{report_id}")
def delete_incident_report(
    report_id: int,
    user=Depends(require_roles("Response Coordinator", "Community Member")),
) -> dict:
    # Required role: Response Coordinator, Community Member
    # If community member, must match community member ID that created it
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
    # Add into corresponding role table
    return new_user_details

# Authenticate user
@app.post("/api/login")
def login(request: Request, credentials: UserLogin):
    # Get hashed password from database
    hash_details = db.get_password_hash(credentials.user_name)
    if hash_details:
        stored_hash = hash_details["password_hash"]
        is_valid = password_hasher.verify(credentials.password, stored_hash)
        if is_valid:
            request.session["user_id"] = hash_details["user_id"]
            request.session["role"] = hash_details["role"]
            # return Response(status_code=200)
            return {"message": f"Authentication successful",
                    "role": f"{hash_details['role']}"}
        else:
            raise HTTPException(status_code=401, detail=f"Invalid password")
    else:
        raise HTTPException(status_code=401, detail=f"Invalid username")

@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return Response(status_code=204)

@app.get("/api/me")
def user_details(user = Depends(get_current_user)):
    user_info = db.get_user_details(user["user_id"])
    return user_info

# Get all incident reports - include GeoJSON y/n
@app.get("/api/incidents")
def get_incidents(type: str = None, status: str = None, district_id: int = None, as_geojson: bool = False):
    return db.get_incidents(type, status, district_id, as_geojson)

# Get count of incident report by type and total incident count
@app.get("/api/incidents/stats")
def get_incident_stats(district_id: int = None):
    return db.get_incident_stats(district_id)

@app.get("/api/districts")
def get_districts():
    return db.get_districts()

# Get all incident reports inside a district
# Get incident report type counts by district
# Get incident report status counts by district