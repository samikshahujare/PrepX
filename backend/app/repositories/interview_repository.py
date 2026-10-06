import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.interview import InterviewSession, InterviewTranscript, Question
from app.schemas.interview import InterviewSessionCreate


class InterviewRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_session(
        self, user_id: uuid.UUID, session_in: InterviewSessionCreate
    ) -> InterviewSession:
        session = InterviewSession(
            user_id=user_id,
            resume_id=session_in.resume_id,
            domain=session_in.domain.strip(),
            company=session_in.company.strip() if session_in.company else None,
            target_role=session_in.target_role.strip() if session_in.target_role else None,
            interview_mode=session_in.interview_mode,
            duration_minutes=session_in.duration_minutes,
            allowed_attempts=session_in.allowed_attempts,
            current_attempt=1,
            difficulty=session_in.difficulty,
            job_description=session_in.job_description,
            jd_analysis=session_in.jd_analysis or {},
            company_research={},
            status="ready",
            interview_status="idle",
            current_question_index=0,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session_by_id(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[InterviewSession]:
        return (
            self.db.query(InterviewSession)
            .options(
                joinedload(InterviewSession.questions),
                joinedload(InterviewSession.transcripts),
            )
            .filter(
                InterviewSession.id == session_id,
                InterviewSession.user_id == user_id,
            )
            .first()
        )

    def list_sessions_by_user(self, user_id: uuid.UUID) -> List[InterviewSession]:
        return (
            self.db.query(InterviewSession)
            .options(
                joinedload(InterviewSession.questions),
                joinedload(InterviewSession.transcripts),
            )
            .filter(InterviewSession.user_id == user_id)
            .order_by(InterviewSession.created_at.desc())
            .all()
        )

    def save_questions(
        self, session_id: uuid.UUID, questions_data: List[Dict[str, Any]]
    ) -> List[Question]:
        # Delete existing questions for this session if regenerating
        self.db.query(Question).filter(Question.session_id == session_id).delete()

        created_questions = []
        for q in questions_data:
            db_question = Question(
                session_id=session_id,
                question_text=q["question_text"],
                category=q.get("category", "Technical"),
                difficulty=q.get("difficulty", "Medium"),
                source=q.get("source", "mock"),
                sequence_number=q.get("sequence_number", 1),
                is_asked=False,
            )
            self.db.add(db_question)
            created_questions.append(db_question)

        self.db.commit()
        for q in created_questions:
            self.db.refresh(q)
        return created_questions

    def get_questions_by_session(
        self, session_id: uuid.UUID
    ) -> List[Question]:
        return (
            self.db.query(Question)
            .filter(Question.session_id == session_id)
            .order_by(Question.sequence_number.asc())
            .all()
        )

    def add_transcript(
        self,
        session_id: uuid.UUID,
        speaker: str,
        message: str,
        question_id: Optional[uuid.UUID] = None,
        is_followup: bool = False,
    ) -> InterviewTranscript:
        # Determine sequence number
        last_seq = (
            self.db.query(InterviewTranscript.sequence_number)
            .filter(InterviewTranscript.session_id == session_id)
            .order_by(InterviewTranscript.sequence_number.desc())
            .first()
        )
        seq_num = (last_seq[0] + 1) if last_seq else 1

        transcript = InterviewTranscript(
            session_id=session_id,
            question_id=question_id,
            speaker=speaker,
            message=message.strip(),
            sequence_number=seq_num,
            is_followup=is_followup,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(transcript)
        self.db.commit()
        self.db.refresh(transcript)
        return transcript

    def get_transcripts_by_session(
        self, session_id: uuid.UUID
    ) -> List[InterviewTranscript]:
        return (
            self.db.query(InterviewTranscript)
            .filter(InterviewTranscript.session_id == session_id)
            .order_by(InterviewTranscript.sequence_number.asc())
            .all()
        )
