from slowapi import Limiter
from slowapi.util import get_remote_address


def _rate_limit_key(request) -> str:
    """Use user ID for authenticated requests, IP for anonymous."""
    token = request.cookies.get("session")
    if token:
        parts = token.split(":")
        if len(parts) == 3:
            return f"user:{parts[0]}"
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)

MAX_PER_PAGE = 100
