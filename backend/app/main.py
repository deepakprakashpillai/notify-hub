from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import base64
import binascii
import secrets
from fastapi.responses import JSONResponse

from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup before app starts
    yield
    # Cleanup after app stops

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def protect_management(request, call_next):
    # Event producers authenticate with their environment API key; all management
    # endpoints require separate operator credentials in production.
    if settings.ENVIRONMENT != "production" or request.url.path == "/health" or (
        request.method == "POST" and request.url.path == "/v1/events"
    ):
        return await call_next(request)

    username = password = ""
    header = request.headers.get("Authorization", "")
    if header.startswith("Basic "):
        try:
            decoded = base64.b64decode(header[6:], validate=True).decode("utf-8")
            username, password = decoded.split(":", 1)
        except (ValueError, UnicodeDecodeError, binascii.Error):
            pass
    valid_user = secrets.compare_digest(username.encode(), settings.ADMIN_USERNAME.encode())
    valid_password = secrets.compare_digest(password.encode(), settings.ADMIN_PASSWORD.encode())
    if not (valid_user and valid_password):
        return JSONResponse(
            status_code=401,
            content={"detail": "Management authentication required"},
            headers={"WWW-Authenticate": 'Basic realm="Notify Hub", charset="UTF-8"'},
        )
    return await call_next(request)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}

from app.api.v1.router import router as v1_router

app.include_router(v1_router, prefix="/v1")
