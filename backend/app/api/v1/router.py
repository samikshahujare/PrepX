from fastapi import APIRouter
from app.api.v1.endpoints import auth, avatar, gd, health, interviews, resumes, users

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["Resumes"])
api_router.include_router(interviews.router, prefix="/interview-sessions", tags=["Interview Sessions"])
api_router.include_router(avatar.router, prefix="/avatar", tags=["Avatar"])
api_router.include_router(gd.router, prefix="/gd", tags=["Group Discussion"])

