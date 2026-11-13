from fastapi import FastAPI, HTTPException, Query, Request, Response, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from pwdlib import PasswordHash
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
from . import database as db
from .email_sender import send_password_reset_email
from .members_portal import members_gateway as mdb
from typing import Literal

import os
import hashlib
import secrets
from urllib.parse import urlencode

load_dotenv()


app = FastAPI(title="Disaster Request API", version="1.0.0")
app.mount("/assets", StaticFiles(directory="frontend"), name="assets")
password_hasher = PasswordHash.recommended()

# Where the HTML pages are served. FastAPI serves them itself (see the page routes at the bottom).
FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:8000").rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
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

app.include_router(mdb.router)  # Include the members portal router


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
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    street_address: str
    city: str
    state: str
    tel_no: str = Field(pattern=r"^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$")

class UserLogin(BaseModel):
    user_name: str
    password: str

# What a signed-in community member sends from the "Report an incident" tab.
# There is no member_id or status here on purpose: the server takes member_id
# from the login session (so nobody can file a report as someone else) and
# every new report starts as "Pending Assistance".

class MyReport(BaseModel):

    type: Literal["Fallen Tree", "Flood", "Fire", "Power"]
    address: str = Field(min_length=1, max_length=300)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    image_url: str | None = None
    description: str = Field(min_length=1, max_length=5000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ResetRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)  # trim before the pattern check
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

class ResetConfirm(BaseModel):
    token: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8)

# --------- Dependencies -------------
def get_current_user(request: Request):
    print(request.session)
    user_id = request.session.get("user_id")
    role = request.session.get("role")

    if user_id is None or role is None:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    return {"user_id": user_id, "role": role}

# Role-based access control
def require_roles(*allowed_roles):
    # Returns a dependency that checks if the current user has one of the allowed roles.
    def check_role(user = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Forbidden"
            )
        return user
    return check_role


def current_member_id(user = Depends(require_roles("Community Member"))) -> int:
    # Turns the signed-in account (users.user_id) into its community_members.member_id.
    member_id = db.get_member_id(user["user_id"])
    if member_id is None:
        raise HTTPException(
            status_code=403,
            detail="This account isn't linked to a community member profile."
        )
    return member_id

# Build password reset link
def build_reset_link(raw_token: str) -> str:
    query = urlencode({"token": raw_token})
    return f"{FRONTEND_BASE_URL}/reset-password?{query}"

# Request password reset
def issue_reset_and_email(email: str):
    # Runs after the response is sent (BackgroundTasks), so every request
    # returns equally fast whether or not the email has an account.
    try:
        user_id = db.get_user_id_by_email(email)
        if user_id is None:
            return
        raw_token = secrets.token_urlsafe(48)                       # goes in the email
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest() # goes in the DB
        db.create_password_reset_token(user_id, token_hash)         # store the hashed token in the database
        send_password_reset_email(email, build_reset_link(raw_token))
    except Exception as exc:
        # The user already got the generic response; just record the failure.
        print("Password reset failed in background:", type(exc).__name__, exc)

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
    report_id: int
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
    columns, rows = db.create_user(
        first_name=user_details.first_name,
        last_name=user_details.last_name,
        role=user_details.role,
        username=user_details.user_name,
        password_hash=hashed_password,
        street_address=user_details.street_address,
        city=user_details.city,
        state=user_details.state,
        tel_no=user_details.tel_no,
        email=user_details.email.strip().lower(),  # stored lowercase so reset lookups match
    )
    new_user_details = dict(zip(columns, rows[0]))
    del new_user_details["password_hash"]
    # Add into corresponding role table
    return new_user_details

# Authenticate user
@app.post("/api/login")
def login(request: Request, credentials: UserLogin):
    # print("Logging in...", credentials.user_name, "with password:", credentials.password)
    # Get hashed password from database
    hash_details = db.get_password_hash(credentials.user_name)
    if hash_details:
        stored_hash = hash_details["password_hash"]
        is_valid = password_hasher.verify(credentials.password, stored_hash)
        if is_valid:
            request.session["user_id"] = hash_details["user_id"]
            request.session["role"] = hash_details["role"]
            # db.get_user_details(user["user_id"])
            # print(request.session)
            # return Response(status_code=200)
            return {"message": f"Authentication successful",
                    "role": f"{hash_details['role']}"}
        else:
            raise HTTPException(status_code=401, detail=f"Invalid password")
    else:
        raise HTTPException(status_code=401, detail=f"Invalid username")

# Logout user
@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return Response(status_code=204)

# Request password reset
@app.post("/api/password-reset/request")
def request_password_reset(body: ResetRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(issue_reset_and_email, body.email.lower())
    return {"message": "If an account exists for that email, a reset link has been sent."}

# Confirm password reset (the form on reset-password.html)
@app.post("/api/password-reset/confirm")
def confirm_password_reset(body: ResetConfirm):
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()  # same hash as when it was stored
    new_hash = password_hasher.hash(body.new_password)
    if not db.redeem_password_reset_token(token_hash, new_hash):
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Request a new one.",
        )
    return {"message": "Password updated. You can now log in."}

# Get current user details
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
def get_districts(include_counts: bool = False):
    return db.get_districts(include_counts)

@app.get("/api/help-requests")
def get_help_requests():
    return db.get_help_requests()

@app.get("/api/help-requests/counts")
def get_help_request_counts():
    return db.get_help_request_counts()

@app.get("/api/resources")
def get_resources():
    return db.get_resources()

# Index page
@app.get("/")
def index_page():
    return FileResponse("frontend/index.html")

# Login page
@app.get("/login")
def login_page():
    return FileResponse("frontend/login.html")

# Reset password page
@app.get("/reset-password")
def reset_password_page():
    return FileResponse("frontend/reset-password.html")

# Coordinator page
@app.get("/coordinator")
def coordinator(request: Request):
    print("/coordinator")
    print(request.session)
    if "user_id" not in request.session:
        return RedirectResponse(url="/login", status_code=303)
    return FileResponse("frontend/coordinator-index.html")

# Community member page
@app.get("/community-member")
def community_member(request: Request):
    print("/community-member")
    print(request.session)
    if "user_id" not in request.session:
        return RedirectResponse(url="/login", status_code=303)
    return FileResponse("frontend/community-member.html")
