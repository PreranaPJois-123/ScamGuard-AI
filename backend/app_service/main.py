from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app_service.api.v1.router import api_router
from app_service.core.config import get_settings
from app_service.core.exception_handlers import register_exception_handlers
from app_service.core.logging_config import configure_logging
from app_service.core.rate_limit import limiter
from app_service.db.base import Base
from app_service.db.session import engine
from app_service.middleware.logging_middleware import RequestLoggingMiddleware
from app_service.middleware.security_headers_middleware import SecurityHeadersMiddleware

configure_logging()
settings = get_settings()


try:
    from prometheus_fastapi_instrumentator import Instrumentator
    HAS_PROMETHEUS = True
except ImportError:
    HAS_PROMETHEUS = False

try:
    from fastapi_cache import FastAPICache
    from fastapi_cache.backends.inmemory import InMemoryBackend
    HAS_FASTAPI_CACHE = True
except ImportError:
    HAS_FASTAPI_CACHE = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    if HAS_FASTAPI_CACHE:
        FastAPICache.init(InMemoryBackend())
    db_connected = False
    for attempt in range(5):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            db_connected = True
            break
        except OperationalError:
            import time
            time.sleep(1.5)
    if not db_connected:
        raise RuntimeError("Database is unavailable. Ensure the database is reachable and DATABASE_URL is correct.")
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG, lifespan=lifespan)

if HAS_PROMETHEUS:
    Instrumentator().instrument(app).expose(app)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response

# --- Rate limiting -----------------------------------------------------
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error_code": "RATE_LIMIT_EXCEEDED",
            "message": "Too many requests, please try again later",
        },
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# --- CORS ----------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security headers + structured request logging ------------------------
app.add_middleware(RequestLoggingMiddleware)

# --- Global exception handling --------------------------------------------
register_exception_handlers(app)

# --- Routes ----------------------------------------------------------------
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
