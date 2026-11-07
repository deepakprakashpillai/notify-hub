from uuid import UUID

from fastapi import Depends, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.application import ApplicationEnvironment
from app.core.security import verify_api_key

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def get_current_environment(
    api_key_header: str = Security(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> ApplicationEnvironment:
    if not api_key_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key missing",
        )
    
    # We expect "Bearer <key>" or just "<key>"
    key = api_key_header.replace("Bearer ", "").strip()
    
    try:
        env_id_str, secret = key.split(".", 1)
        env_id = UUID(env_id_str)
    except (ValueError, AttributeError, IndexError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format",
        )
    
    stmt = select(ApplicationEnvironment).where(ApplicationEnvironment.id == env_id)
    result = await db.execute(stmt)
    env = result.scalar_one_or_none()
    
    if not env or not env.is_active or not env.api_key_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
        
    if not verify_api_key(secret, env.api_key_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
        
    return env

