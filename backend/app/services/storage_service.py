import os
import uuid
from pathlib import Path
from typing import Tuple
from fastapi import UploadFile
from app.core.exceptions import PrepXException

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class StorageService:
    """Storage service abstraction allowing local development and easy cloud swap."""

    def __init__(self, base_upload_dir: str = "uploads/resumes"):
        self.base_upload_dir = Path(base_upload_dir)
        self.base_upload_dir.mkdir(parents=True, exist_ok=True)

    def validate_file(self, filename: str, content_type: str, file_size: int) -> str:
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise PrepXException(
                status_code=400,
                detail=f"Unsupported file format '{ext}'. Only PDF (.pdf) and Word (.docx) files are supported.",
                code="UNSUPPORTED_FILE_TYPE",
            )
        if file_size > MAX_FILE_SIZE:
            raise PrepXException(
                status_code=400,
                detail=f"File exceeds maximum allowed size of 10MB.",
                code="FILE_TOO_LARGE",
            )
        return ext.replace(".", "")

    async def save_file(self, user_id: uuid.UUID, file: UploadFile) -> Tuple[str, str, int, str]:
        """Save uploaded file to storage and return (stored_filename, storage_path, file_size, file_type)."""
        content = await file.read()
        file_size = len(content)
        filename = file.filename or "resume.pdf"
        file_type = self.validate_file(filename, file.content_type or "", file_size)

        # Generate unique storage filename
        stored_filename = f"{user_id}_{uuid.uuid4().hex[:8]}_{Path(filename).name}"
        file_path = self.base_upload_dir / stored_filename

        with open(file_path, "wb") as f:
            f.write(content)

        # Reset cursor
        await file.seek(0)
        return stored_filename, str(file_path), file_size, file_type

    def delete_file(self, file_path_str: str) -> None:
        try:
            path = Path(file_path_str)
            if path.exists():
                path.unlink()
        except Exception:
            pass
