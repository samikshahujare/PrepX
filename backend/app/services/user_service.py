import uuid
from sqlalchemy.orm import Session
from app.core.exceptions import UserNotFoundException
from app.models.user import User, UserProfile
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserProfileUpdate


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def get_user_by_id(self, user_id: uuid.UUID) -> User:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundException()
        return user

    def update_profile(
        self, user_id: uuid.UUID, profile_in: UserProfileUpdate
    ) -> UserProfile:
        user = self.get_user_by_id(user_id)
        updated_profile = self.user_repo.update_profile(user.id, profile_in)
        if not updated_profile:
            raise UserNotFoundException("User profile not found")
        return updated_profile
