import uuid
from typing import Optional
from sqlalchemy.orm import Session, joinedload
from app.models.user import User, UserProfile
from app.schemas.user import UserCreate, UserProfileUpdate


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        return (
            self.db.query(User)
            .options(joinedload(User.profile))
            .filter(User.id == user_id)
            .first()
        )

    def get_by_email(self, email: str) -> Optional[User]:
        return (
            self.db.query(User)
            .options(joinedload(User.profile))
            .filter(User.email == email.lower().strip())
            .first()
        )

    def create(self, user_in: UserCreate, password_hash: str) -> User:
        user = User(
            email=user_in.email.lower().strip(),
            password_hash=password_hash,
            is_active=True,
            is_verified=False,
        )
        self.db.add(user)
        self.db.flush()  # Obtain user.id

        profile = UserProfile(
            user_id=user.id,
            full_name=user_in.full_name.strip(),
        )
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_profile(
        self, user_id: uuid.UUID, profile_in: UserProfileUpdate
    ) -> Optional[UserProfile]:
        profile = (
            self.db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        )
        if not profile:
            return None

        update_data = profile_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)

        self.db.commit()
        self.db.refresh(profile)
        return profile
