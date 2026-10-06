import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.token import RefreshToken


class TokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_refresh_token(
        self, user_id: uuid.UUID, token_hash: str, expires_at: datetime
    ) -> RefreshToken:
        db_token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_revoked=False,
        )
        self.db.add(db_token)
        self.db.commit()
        self.db.refresh(db_token)
        return db_token

    def get_valid_refresh_token(self, token_hash: str) -> Optional[RefreshToken]:
        now = datetime.now(timezone.utc)
        return (
            self.db.query(RefreshToken)
            .filter(
                RefreshToken.token_hash == token_hash,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > now,
            )
            .first()
        )

    def revoke_token(self, token_hash: str) -> bool:
        token = (
            self.db.query(RefreshToken)
            .filter(RefreshToken.token_hash == token_hash)
            .first()
        )
        if token:
            token.is_revoked = True
            self.db.commit()
            return True
        return False
