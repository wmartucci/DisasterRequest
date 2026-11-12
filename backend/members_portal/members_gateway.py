from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .. import database as db

from . import members_db as mdb

router = APIRouter()

MEMBER_ROLE = "Community Member"


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
    found = mdb.find_member_id(user["user_id"])
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


class NewComment(BaseModel):
    content: str = Field(min_length=1, max_length=1000)



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
    profile_id = mdb.find_member_id(user["user_id"])
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
    columns, rows = mdb.create_member(user["user_id"], *parts, body.tel_no.strip())
    return dict(zip(columns, rows[0]))


@router.get("/api/my-reports")
def my_reports(member=Depends(member_id)) -> list[dict]:
    return mdb.reports_for_member(member)


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
    if mdb.delete_report_of_member(report_id, member) == 0:
        if mdb.report_owner(report_id) is None:
            raise HTTPException(404, "Report not found")
        raise HTTPException(403, "You can only delete your own reports")
    return {"report_id": report_id, "deleted": True}


@router.get("/api/posts")
def posts(user=Depends(logged_in)) -> list[dict]:
    viewer = mdb.find_member_id(user["user_id"]) if user["role"] == MEMBER_ROLE else None
    return mdb.all_posts(viewer)


@router.post("/api/posts", status_code=201)
def create_post(post: NewPost, member=Depends(member_id)) -> dict:
    columns, rows = mdb.add_post(member, post.post_title.strip(), post.post_content.strip())
    return dict(zip(columns, rows[0]))


@router.delete("/api/posts/{post_id}")
def delete_post(post_id: int, member=Depends(member_id)) -> dict:
    # Members may delete only their own posts.
    owner = mdb.post_owner(post_id)
    if owner is None:
        raise HTTPException(404, "Post not found")
    if owner != member:
        raise HTTPException(403, "You can only delete your own posts")
    mdb.remove_post(post_id)
    return {"post_id": post_id, "deleted": True}

@router.get("/api/posts/{post_id}/comments")
def get_post_comments(post_id: int, user=Depends(logged_in)) -> list[dict]:
    # Any logged-in user can view comments on a post.
    return mdb.get_post_comments(post_id)

@router.post("/api/posts/{post_id}/comments", status_code=201)
def add_post_comment(post_id: int, comment: NewComment, member=Depends(member_id)) -> dict:
    # Any logged-in user can add a comment to a post.
    if mdb.post_owner(post_id) is None:
        raise HTTPException(404, "Post not found")
    columns, rows = mdb.add_comment(post_id, comment.content.strip(), member)
    return dict(zip(columns, rows[0]))
