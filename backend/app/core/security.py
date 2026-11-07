from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_api_key(plain_api_key: str, hashed_api_key: str) -> bool:
    return pwd_context.verify(plain_api_key, hashed_api_key)

def get_api_key_hash(api_key: str) -> str:
    return pwd_context.hash(api_key)
