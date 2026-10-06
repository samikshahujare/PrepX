import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.resume import Resume, ResumeProfile


class ResumeRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        user_id: uuid.UUID,
        original_filename: str,
        file_type: str,
        file_size: int,
        storage_path: str,
        extracted_text: str,
        parsed_data: Dict[str, Any],
    ) -> Resume:
        resume = Resume(
            user_id=user_id,
            original_filename=original_filename,
            file_type=file_type,
            file_size=file_size,
            storage_path=storage_path,
            extracted_text=extracted_text,
            upload_status="parsed",
        )
        self.db.add(resume)
        self.db.flush()

        profile = ResumeProfile(
            resume_id=resume.id,
            candidate_name=parsed_data.get("candidate_name"),
            email=parsed_data.get("email"),
            phone=parsed_data.get("phone"),
            skills=parsed_data.get("skills", []),
            education=parsed_data.get("education", []),
            experience=parsed_data.get("experience", []),
            projects=parsed_data.get("projects", []),
            certifications=parsed_data.get("certifications", []),
            raw_extracted_data=parsed_data.get("raw_extracted_data", {}),
        )
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(resume)
        return resume

    def get_by_id(self, resume_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Resume]:
        return (
            self.db.query(Resume)
            .options(joinedload(Resume.profile))
            .filter(Resume.id == resume_id, Resume.user_id == user_id)
            .first()
        )

    def list_by_user(self, user_id: uuid.UUID) -> List[Resume]:
        return (
            self.db.query(Resume)
            .options(joinedload(Resume.profile))
            .filter(Resume.user_id == user_id)
            .order_by(Resume.created_at.desc())
            .all()
        )

    def delete(self, resume: Resume) -> None:
        self.db.delete(resume)
        self.db.commit()
