from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/health", response_model=ApiResponse[dict], status_code=status.HTTP_200_OK)
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint confirming API and PostgreSQL database connectivity."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return ApiResponse(
        success=True,
        data={
            "status": "online",
            "database": db_status,
        },
        message="PrepX Backend Service is operational",
    )
