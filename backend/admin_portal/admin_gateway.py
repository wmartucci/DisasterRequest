from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pwdlib import PasswordHash
from pydantic import BaseModel, ConfigDict, Field

from . import admin_db as adb

router = APIRouter()
password_hasher = PasswordHash.recommended()

ADMIN_ROLE = "Admin"


# --------------------------------------------------------------------------------#
# WHO IS ASKING?
# --------------------------------------------------------------------------------#

def logged_in(request: Request) -> dict:
    user_id = request.session.get("user_id")
    role = request.session.get("role")
    if user_id is None or role is None:
        raise HTTPException(401, "Not authenticated")
    return {"user_id": user_id, "role": role}


def admin(user=Depends(logged_in)) -> dict:
    """The logged-in user, only if they are an Admin."""
    if user["role"] != ADMIN_ROLE:
        raise HTTPException(403, "Forbidden")
    return user


# --------------------------------------------------------------------------------#
# DATA MODEL CLASSES
# --------------------------------------------------------------------------------#
class NewUser(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: Literal["Community Member", "Response Coordinator", "Responder", "Volunteer", "Admin"]
    user_name: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8)
    email: str = Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    # Response Coordinators only.
    organization: str | None = Field(default=None, max_length=200)
    # Community Members only, and optional: without them the member finishes
    # their profile on first sign-in.
    street_address: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)


class NewPassword(BaseModel):
    new_password: str = Field(min_length=8)


# --------------------------------------------------------------------------------#
# ENDPOINTS
# --------------------------------------------------------------------------------#
@router.get("/api/admin/users")
def list_users(_=Depends(admin)) -> list[dict]:
    return adb.all_users()


@router.post("/api/admin/users", status_code=201)
def create_user(body: NewUser, _=Depends(admin)) -> dict:
    organization = body.organization or None
    if body.role == "Response Coordinator" and not organization:
        raise HTTPException(
            400,
            "Response Coordinators need an organization (enter 'Volunteer' if they don't have one).",
        )

    address = None
    if body.role == "Community Member":
        parts = [body.street_address or "", body.city or "", body.state or ""]
        if any(parts) and not all(parts):
            raise HTTPException(400, "Enter street address, city and state together, or leave all three blank.")
        if all(parts):
            address = parts

    return adb.create_user(
        first_name=body.first_name,
        last_name=body.last_name,
        role=body.role,
        username=body.user_name,
        password_hash=password_hasher.hash(body.password),
        email=body.email.lower(),  # stored lowercase so reset lookups match
        organization=organization if body.role == "Response Coordinator" else None,
        street_address=address[0] if address else None,
        city=address[1] if address else None,
        state=address[2] if address else None,
    )


@router.patch("/api/admin/users/{user_id}/password")
def change_password(user_id: int, body: NewPassword, _=Depends(admin)) -> dict:
    if adb.set_password(user_id, password_hasher.hash(body.new_password)) == 0:
        raise HTTPException(404, "User not found")
    return {"user_id": user_id, "password_changed": True}


@router.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, me=Depends(admin)) -> dict:
    # An admin can't delete their own account (it would also lock them out mid-session).
    if user_id == me["user_id"]:
        raise HTTPException(400, "You can't delete your own account")
    if adb.delete_user(user_id) == 0:
        raise HTTPException(404, "User not found")
    return {"user_id": user_id, "deleted": True}
