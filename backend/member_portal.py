"""API endpoints for the Community Member page (community-member.html)."""
import psycopg2
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from . import database as db

router = APIRouter()

MEMBER_ROLE = "Community Member"


# --------------------------------------------------------------------------------#
# DATABASE QUERIES (kept here, next to the endpoints that use them)
# --------------------------------------------------------------------------------#
def find_member_id(user_id):
    rows = db.run_query("SELECT member_id FROM community_members WHERE user_id = %s;", (user_id,))
    return rows[0]["member_id"] if rows else None


def create_member(user_id, first, last, street_address, city, state, tel_no):
    try:
        return db.run_change_returning(
            "INSERT INTO community_members "
            "(first_name, last_name, street_address, city, state, tel_no, user_id) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *;",
            (first, last, street_address, city, state, tel_no, user_id),
        )
    except psycopg2.errors.CheckViolation as e:
        raise db.InvalidTypeError("Phone number must look like 5405551234 or 540-555-1234") from e
    except psycopg2.errors.UniqueViolation as e:
        raise db.DuplicateValueError("This login already has a profile") from e


def reports_for_member(member_id):
    # Friendly names (coordinator, unit) instead of raw ids.
    return db.run_query(
        """SELECT i.report_id, i.type, i.address, i.city, i.state,
                  i.report_timestamp, i.description, i.status, i.image_url,
                  c.first_name || ' ' || c.last_name AS coordinator_name,
                  u.unit_name,
                  h.status AS help_request_status
           FROM incident_reports i
           LEFT JOIN response_coordinators c ON c.coordinator_id = i.coordinator_id
           LEFT JOIN help_requests h ON h.report_id = i.report_id
           LEFT JOIN response_units u ON u.unit_id = h.unit_id
           WHERE i.member_id = %s
           ORDER BY i.report_timestamp DESC;""",
        (member_id,),
    )


def report_owner(report_id):
    rows = db.run_query("SELECT member_id FROM incident_reports WHERE report_id = %s;", (report_id,))
    return rows[0]["member_id"] if rows else None


def delete_report_of_member(report_id, member_id):
    # Deletes only if the report belongs to this member. Returns rows deleted.
    return db.run_change(
        "DELETE FROM incident_reports WHERE report_id = %s AND member_id = %s;",
        (report_id, member_id),
    )


def all_posts(viewer_member_id):
    # is_mine tells the page which posts the viewer wrote (so it can offer "delete").
    return db.run_query(
        """SELECT p.post_id, p.member_id, p.post_title, p.post_content,
                  p.post_timestamp, p.media,
                  m.first_name, m.last_name,
                  (p.member_id = %s) AS is_mine
           FROM posts p
           JOIN community_members m ON m.member_id = p.member_id
           ORDER BY p.post_timestamp DESC;""",
        (viewer_member_id,),
    )


def add_post(member_id, title, content):
    return db.run_change_returning(
        "INSERT INTO posts (member_id, post_title, post_content) "
        "VALUES (%s, %s, %s) RETURNING *;",
        (member_id, title, content),
    )


def post_owner(post_id):
    rows = db.run_query("SELECT member_id FROM posts WHERE post_id = %s;", (post_id,))
    return rows[0]["member_id"] if rows else None


def remove_post(post_id):
    return db.run_change("DELETE FROM posts WHERE post_id = %s;", (post_id,))


# --------------------------------------------------------------------------------#
# WHO IS ASKING?
# --------------------------------------------------------------------------------#
def logged_in(request: Request) -> dict:
    user_id = request.session.get("user_id")
    role = request.session.get("role")
    if user_id is None or role is None:
        raise HTTPException(401, "Not authenticated")
    return {"user_id": user_id, "role": role}


def member_id(user=Depends(logged_in)) -> int:
    """The community_members row of the logged-in Community Member."""
    if user["role"] != MEMBER_ROLE:
        raise HTTPException(403, "Forbidden")
    found = find_member_id(user["user_id"])
    if found is None:
        raise HTTPException(409, "Finish your profile first")
    return found


# --------------------------------------------------------------------------------#
# DATA MODEL CLASSES
# --------------------------------------------------------------------------------#
class MemberProfile(BaseModel):
    tel_no: str = Field(min_length=10, max_length=12)
    street_address: str = Field(min_length=1, max_length=300)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)


class NewReport(BaseModel):
    type: str
    address: str = Field(min_length=1, max_length=300)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    image_url: str | None = None
    description: str = Field(min_length=1, max_length=5000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class NewPost(BaseModel):
    post_title: str = Field(min_length=1, max_length=50)
    post_content: str = Field(min_length=1, max_length=3000)


# --------------------------------------------------------------------------------#
# ENDPOINTS
# --------------------------------------------------------------------------------#
@router.get("/api/portal/profile")
def get_profile(user=Depends(logged_in)) -> dict:
    """Tells the page who is signed in and whether their profile exists yet."""
    info = db.get_user_details(user["user_id"])
    if info is None:
        raise HTTPException(401, "Not authenticated")
    if user["role"] != MEMBER_ROLE:
        raise HTTPException(403, "Forbidden")
    profile_id = find_member_id(user["user_id"])
    return {
        "first_name": info["first_name"],
        "last_name": info["last_name"],
        "role": user["role"],
        "profile_id": profile_id,
        "has_profile": profile_id is not None,
    }


@router.post("/api/portal/profile", status_code=201)
def create_profile(body: MemberProfile, user=Depends(logged_in)) -> dict:
    info = db.get_user_details(user["user_id"])
    if info is None:
        raise HTTPException(401, "Not authenticated")
    if user["role"] != MEMBER_ROLE:
        raise HTTPException(403, "Forbidden")
    parts = [body.street_address.strip(), body.city.strip(), body.state.strip()]
    if not all(parts):
        raise HTTPException(422, "Street address, city and state are required")
    columns, rows = create_member(
        user["user_id"], info["first_name"], info["last_name"], *parts, body.tel_no.strip()
    )
    return dict(zip(columns, rows[0]))


@router.get("/api/my-reports")
def my_reports(member=Depends(member_id)) -> list[dict]:
    return reports_for_member(member)


@router.post("/api/my-reports", status_code=201)
def create_my_report(report: NewReport, member=Depends(member_id)) -> dict:
    # The member comes from the login, so nobody can file a report as someone else.
    columns, rows = db.create_incident_report(
        member_id=member,
        type=report.type,
        address=report.address.strip(),
        city=report.city.strip(),
        state=report.state.strip(),
        image_url=report.image_url or None,
        description=report.description.strip(),
        status="Pending Assistance",
        latitude=report.latitude,
        longitude=report.longitude,
    )
    return dict(zip(columns, rows[0]))


@router.delete("/api/my-reports/{report_id}")
def delete_my_report(report_id: int, member=Depends(member_id)) -> dict:
    # Only the member who filed the report may delete it.
    if delete_report_of_member(report_id, member) == 0:
        if report_owner(report_id) is None:
            raise HTTPException(404, "Report not found")
        raise HTTPException(403, "You can only delete your own reports")
    return {"report_id": report_id, "deleted": True}


@router.get("/api/posts")
def posts(user=Depends(logged_in)) -> list[dict]:
    viewer = find_member_id(user["user_id"]) if user["role"] == MEMBER_ROLE else None
    return all_posts(viewer)


@router.post("/api/posts", status_code=201)
def create_post(post: NewPost, member=Depends(member_id)) -> dict:
    columns, rows = add_post(member, post.post_title.strip(), post.post_content.strip())
    return dict(zip(columns, rows[0]))


@router.delete("/api/posts/{post_id}")
def delete_post(post_id: int, member=Depends(member_id)) -> dict:
    # Members may delete only their own posts.
    owner = post_owner(post_id)
    if owner is None:
        raise HTTPException(404, "Post not found")
    if owner != member:
        raise HTTPException(403, "You can only delete your own posts")
    remove_post(post_id)
    return {"post_id": post_id, "deleted": True}
