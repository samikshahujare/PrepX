from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import PrepXException
from app.core.logging import setup_logging, logger

# Initialize structured logging
setup_logging()

app = FastAPI(
    title=settings.APP_NAME,
    description="PrepX AI-Powered Interview Training Platform - REST API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Configure Cross-Origin Resource Sharing (CORS)
cors_origins = list(settings.CORS_ORIGINS)
if settings.APP_PUBLIC_URL:
    clean_pub = settings.APP_PUBLIC_URL.strip().rstrip("/")
    if clean_pub and clean_pub not in cors_origins:
        cors_origins.append(clean_pub)
if settings.FRONTEND_URL:
    clean_front = settings.FRONTEND_URL.strip().rstrip("/")
    if clean_front and clean_front not in cors_origins:
        cors_origins.append(clean_front)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(PrepXException)
async def prepx_exception_handler(request: Request, exc: PrepXException):
    """Handle custom application domain exceptions with consistent JSON envelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "message": exc.detail,
            "error": {
                "code": exc.code,
                "message": exc.detail,
                "details": None,
            },
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request payload validation errors."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "data": None,
            "message": "Validation error in request parameters",
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Validation failed for one or more fields",
                "details": exc.errors(),
            },
        },
    )


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler to avoid leaking internal trace details."""
    logger.error(f"Unhandled error processing request {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "data": None,
            "message": "An internal server error occurred",
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Something went wrong on the server",
                "details": None,
            },
        },
    )


# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }
