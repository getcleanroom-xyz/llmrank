"""Password hashing utilities using bcrypt directly."""
import logging

import bcrypt

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hash a plaintext password. bcrypt silently truncates at 72 bytes."""
    if len(password.encode()) > 72:
        logger.warning("Password exceeds 72 bytes — will be truncated by bcrypt")
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except (ValueError, TypeError):
        logger.warning("Malformed bcrypt hash — treating as invalid")
        return False
