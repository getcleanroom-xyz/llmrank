"""WebAuthn schemas and base64url helpers."""
import base64

from pydantic import BaseModel, EmailStr, Field


class RegisterStartRequest(BaseModel):
    email: EmailStr
    display_name: str

class RegisterStartResponse(BaseModel):
    challenge: str
    rp_id: str
    user_id: str

class RegisterFinishRequest(BaseModel):
    credential: dict
    device_name: str

class LoginStartRequest(BaseModel):
    email: EmailStr

class LoginStartResponse(BaseModel):
    challenge: str
    rp_id: str
    allow_credentials: list[str]

class LoginFinishRequest(BaseModel):
    credential: dict

class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: str
    is_admin: bool = False

class PasskeyResponse(BaseModel):
    id: str
    device_name: str
    created_at: str
    last_used_at: str


# ─── Email + Password Auth ────────────────────────────────────────────────────

class EmailRegisterRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=200)
    password: str = Field(..., min_length=8, max_length=128)

class EmailLoginRequest(BaseModel):
    email: EmailStr
    password: str


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64url_decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)
