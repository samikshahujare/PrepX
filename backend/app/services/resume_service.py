import uuid
from typing import List
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.core.exceptions import PrepXException
from app.models.resume import Resume
from app.repositories.resume_repository import ResumeRepository
from app.services.extraction_service import ResumeExtractorService
from app.services.parser_service import ResumeParserService
from app.services.storage_service import StorageService


class ResumeService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ResumeRepository(db)
        self.storage = StorageService()
        self.parser = ResumeParserService()

    async def upload_and_parse(self, user_id: uuid.UUID, file: UploadFile) -> Resume:
        # 1. Save file locally
        stored_filename, storage_path, file_size, file_type = await self.storage.save_file(
            user_id=user_id, file=file
        )

        try:
            # 2. Extract plain text
            extracted_text = ResumeExtractorService.extract_text(
                file_path_str=storage_path, file_type=file_type
            )

            # 3. Parse structured candidate profile
            parsed_data = self.parser.parse_resume(extracted_text)

            # 4. Persist in database
            resume = self.repo.create(
                user_id=user_id,
                original_filename=file.filename or "resume",
                file_type=file_type,
                file_size=file_size,
                storage_path=storage_path,
                extracted_text=extracted_text,
                parsed_data=parsed_data,
            )
            return resume
        except Exception as e:
            # Clean up storage if database insertion fails
            self.storage.delete_file(storage_path)
            if isinstance(e, PrepXException):
                raise e
            raise PrepXException(
                status_code=422,
                detail=f"Failed to process resume file: {str(e)}",
                code="RESUME_PROCESSING_ERROR",
            )

    def get_resume(self, resume_id: uuid.UUID, user_id: uuid.UUID) -> Resume:
        resume = self.repo.get_by_id(resume_id=resume_id, user_id=user_id)
        if not resume:
            raise PrepXException(
                status_code=404, detail="Resume not found", code="RESUME_NOT_FOUND"
            )
        return resume

    def list_resumes(self, user_id: uuid.UUID) -> List[Resume]:
        return self.repo.list_by_user(user_id=user_id)

    def delete_resume(self, resume_id: uuid.UUID, user_id: uuid.UUID) -> None:
        resume = self.get_resume(resume_id=resume_id, user_id=user_id)
        self.storage.delete_file(resume.storage_path)
        self.repo.delete(resume)
