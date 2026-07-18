from slowapi import Limiter
from slowapi.util import get_remote_address


def _rate_limit_key(request) -> str:
    """Use user ID for authenticated requests, IP for anonymous.

    Verifies the session token signature before trusting the user ID
    to prevent IDOR via forged cookies.
    """
    token = request.cookies.get("session")
    if token:
        from app.api.auth import _verify_session_token
        user_id = _verify_session_token(token)
        if user_id:
            return f"user:{user_id}"
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)

MAX_PER_PAGE = 100
