import bcrypt


def _encode_password(password: str) -> bytes:
    secret = password.encode("utf-8")
    if len(secret) > 72:
        raise ValueError("Le mot de passe ne peut pas dépasser 72 octets.")
    return secret


def hash_password(password: str) -> str:
    secret = _encode_password(password)
    return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        secret = _encode_password(plain_password)
    except ValueError:
        return False
    try:
        return bcrypt.checkpw(secret, hashed_password.encode("utf-8"))
    except ValueError:
        return False
