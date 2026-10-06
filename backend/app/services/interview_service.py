import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.adapters.interview_engine.factory import get_interview_engine
from app.adapters.question_generator.factory import get_question_generator
from app.core.exceptions import PrepXException
from app.models.interview import InterviewSession, InterviewTranscript, Question
from app.repositories.interview_repository import InterviewRepository
from app.repositories.resume_repository import ResumeRepository
from app.schemas.interview import (
    AvatarSemanticBehavior,
    InterviewResponseResult,
    InterviewRuntimeState,
    InterviewSessionCreate,
    InterviewStartResponse,
    QuestionRead,
    TranscriptRead,
)


class InterviewService:
    def __init__(self, db: Session):
        self.db = db
        self.interview_repo = InterviewRepository(db)
        self.resume_repo = ResumeRepository(db)
        self.question_generator = get_question_generator()
        self.interview_engine = get_interview_engine()

    def create_session(
        self, user_id: uuid.UUID, session_in: InterviewSessionCreate
    ) -> InterviewSession:
        # If resume_id is provided, verify user ownership
        if session_in.resume_id:
            resume = self.resume_repo.get_by_id(
                resume_id=session_in.resume_id, user_id=user_id
            )
            if not resume:
                raise PrepXException(
                    status_code=404,
                    detail="Referenced resume not found or does not belong to you",
                    code="RESUME_NOT_FOUND",
                )

        return self.interview_repo.create_session(
            user_id=user_id, session_in=session_in
        )

    def get_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewSession:
        session = self.interview_repo.get_session_by_id(
            session_id=session_id, user_id=user_id
        )
        if not session:
            raise PrepXException(
                status_code=404,
                detail="Interview session not found",
                code="SESSION_NOT_FOUND",
            )
        return session

    def list_sessions(self, user_id: uuid.UUID) -> List[InterviewSession]:
        return self.interview_repo.list_sessions_by_user(user_id=user_id)

    def generate_questions_for_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID, count: int = 10
    ) -> List[Question]:
        # 1. Fetch and validate session ownership
        session = self.get_session(session_id=session_id, user_id=user_id)

        # 2. Extract skills and projects from linked resume if present
        candidate_skills = []
        candidate_projects = []
        if session.resume_id:
            resume = self.resume_repo.get_by_id(
                resume_id=session.resume_id, user_id=user_id
            )
            if resume and resume.profile:
                candidate_skills = resume.profile.skills or []
                candidate_projects = resume.profile.projects or []

        # 3. Extract JD analysis details if present
        jd_required_skills = []
        jd_responsibilities = []
        if session.jd_analysis and isinstance(session.jd_analysis, dict):
            jd_required_skills = session.jd_analysis.get("required_skills", [])
            jd_responsibilities = session.jd_analysis.get("responsibilities", [])

        # 4. Call Question Generator Provider
        generated_data = self.question_generator.generate_questions(
            domain=session.domain,
            difficulty=session.difficulty,
            company=session.company,
            candidate_skills=candidate_skills,
            candidate_projects=candidate_projects,
            count=count,
            target_role=session.target_role,
            interview_mode=session.interview_mode or "Role-Specific",
            duration_minutes=session.duration_minutes or 30,
            jd_required_skills=jd_required_skills,
            jd_responsibilities=jd_responsibilities,
            job_description=session.job_description,
        )

        # 4. Save generated questions in database
        saved_questions = self.interview_repo.save_questions(
            session_id=session.id, questions_data=generated_data
        )

        # 5. Update session status
        session.status = "ready"
        session.interview_status = "idle"
        session.current_question_index = 0
        self.db.commit()

        return saved_questions

    def get_session_questions(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[Question]:
        self.get_session(session_id=session_id, user_id=user_id)
        return self.interview_repo.get_questions_by_session(session_id=session_id)

    # ---------------- Phase 3 Runtime Methods ----------------

    def start_interview_runtime(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewStartResponse:
        session = self.get_session(session_id=session_id, user_id=user_id)

        # Ensure questions exist; if not, generate them on the fly
        questions = self.interview_repo.get_questions_by_session(session_id=session_id)
        if not questions:
            questions = self.generate_questions_for_session(session_id=session_id, user_id=user_id, count=10)

        first_question = questions[0]
        first_question.is_asked = True

        now = datetime.now(timezone.utc)
        session.interview_status = "active"
        session.status = "in_progress"
        if not session.started_at:
            session.started_at = now
        session.current_question_index = 1
        self.db.commit()

        # Check if greeting is already in transcripts
        existing_transcripts = self.interview_repo.get_transcripts_by_session(session_id=session_id)
        if not existing_transcripts:
            greeting_msg = self.interview_engine.generate_initial_greeting(
                session=session, first_question=first_question
            )
            self.interview_repo.add_transcript(
                session_id=session_id,
                speaker="interviewer",
                message=greeting_msg,
                question_id=first_question.id,
                is_followup=False,
            )
        else:
            greeting_msg = existing_transcripts[0].message

        return InterviewStartResponse(
            session_id=session.id,
            interview_status=session.interview_status,
            current_question=QuestionRead.model_validate(first_question),
            interviewer_message=greeting_msg,
            current_question_index=session.current_question_index,
            total_questions=len(questions),
            started_at=session.started_at or now,
            behavior=AvatarSemanticBehavior(
                state="SPEAKING",
                emotion="WARM_SMILE",
                gesture="RESTING_DESK",
                mouth="SPEAKING",
            ),
        )

    def process_candidate_response(
        self, session_id: uuid.UUID, user_id: uuid.UUID, candidate_response: str
    ) -> InterviewResponseResult:
        session = self.get_session(session_id=session_id, user_id=user_id)

        if session.interview_status == "completed":
            raise PrepXException(
                status_code=400,
                detail="Interview session has already been completed",
                code="INTERVIEW_ALREADY_COMPLETED",
            )

        questions = self.interview_repo.get_questions_by_session(session_id=session_id)
        total_questions = len(questions)

        current_idx = session.current_question_index
        current_question = (
            questions[current_idx - 1] if (1 <= current_idx <= total_questions) else None
        )

        # 1. Record candidate response in transcript
        self.interview_repo.add_transcript(
            session_id=session.id,
            speaker="candidate",
            message=candidate_response,
            question_id=current_question.id if current_question else None,
            is_followup=False,
        )

        # 2. Gather conversation history
        raw_transcripts = self.interview_repo.get_transcripts_by_session(session_id=session.id)
        history = [
            {
                "speaker": t.speaker,
                "message": t.message,
                "is_followup": t.is_followup,
                "question_id": str(t.question_id) if t.question_id else None,
            }
            for t in raw_transcripts
        ]

        # Determine next question
        next_question = (
            questions[current_idx] if (current_idx < total_questions) else None
        )

        # 3. Call AI Interview Engine
        engine_res = self.interview_engine.process_candidate_response(
            session=session,
            current_question=current_question,
            candidate_response=candidate_response,
            conversation_history=history,
            next_question=next_question,
        )

        # 4. Handle follow-up vs transition vs completion
        if engine_res.is_followup:
            # Add follow-up interviewer transcript
            self.interview_repo.add_transcript(
                session_id=session.id,
                speaker="interviewer",
                message=engine_res.interviewer_message,
                question_id=current_question.id if current_question else None,
                is_followup=True,
            )
            self.db.commit()

            return InterviewResponseResult(
                session_id=session.id,
                interview_status=session.interview_status,
                is_followup=True,
                current_question=QuestionRead.model_validate(current_question) if current_question else None,
                interviewer_message=engine_res.interviewer_message,
                current_question_index=session.current_question_index,
                total_questions=total_questions,
                is_completed=False,
                behavior=AvatarSemanticBehavior(
                    state=engine_res.state,
                    emotion=engine_res.emotion,
                    gesture=engine_res.gesture,
                    mouth=engine_res.mouth,
                ),
            )
        else:
            if next_question is not None and not engine_res.is_completed:
                # Advance to next question
                session.current_question_index += 1
                next_question.is_asked = True

                self.interview_repo.add_transcript(
                    session_id=session.id,
                    speaker="interviewer",
                    message=engine_res.interviewer_message,
                    question_id=next_question.id,
                    is_followup=False,
                )
                self.db.commit()

                return InterviewResponseResult(
                    session_id=session.id,
                    interview_status=session.interview_status,
                    is_followup=False,
                    current_question=QuestionRead.model_validate(next_question),
                    interviewer_message=engine_res.interviewer_message,
                    current_question_index=session.current_question_index,
                    total_questions=total_questions,
                    is_completed=False,
                    behavior=AvatarSemanticBehavior(
                        state=engine_res.state,
                        emotion=engine_res.emotion,
                        gesture=engine_res.gesture,
                        mouth=engine_res.mouth,
                    ),
                )
            else:
                # Interview completed!
                now = datetime.now(timezone.utc)
                session.interview_status = "completed"
                session.status = "completed"
                session.ended_at = now

                self.interview_repo.add_transcript(
                    session_id=session.id,
                    speaker="interviewer",
                    message=engine_res.interviewer_message,
                    question_id=None,
                    is_followup=False,
                )
                self.db.commit()

                return InterviewResponseResult(
                    session_id=session.id,
                    interview_status="completed",
                    is_followup=False,
                    current_question=None,
                    interviewer_message=engine_res.interviewer_message,
                    current_question_index=session.current_question_index,
                    total_questions=total_questions,
                    is_completed=True,
                    behavior=AvatarSemanticBehavior(
                        state="COMPLETED",
                        emotion="WARM_SMILE",
                        gesture="RESTING_DESK",
                        mouth="SPEAKING",
                    ),
                )

    def advance_to_next_question(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewResponseResult:
        session = self.get_session(session_id=session_id, user_id=user_id)
        questions = self.interview_repo.get_questions_by_session(session_id=session_id)
        total_questions = len(questions)

        current_idx = session.current_question_index
        if current_idx < total_questions:
            session.current_question_index += 1
            next_q = questions[session.current_question_index - 1]
            next_q.is_asked = True
            msg = f"Skipping to the next question: {next_q.question_text}"

            self.interview_repo.add_transcript(
                session_id=session.id,
                speaker="interviewer",
                message=msg,
                question_id=next_q.id,
                is_followup=False,
            )
            self.db.commit()

            return InterviewResponseResult(
                session_id=session.id,
                interview_status=session.interview_status,
                is_followup=False,
                current_question=QuestionRead.model_validate(next_q),
                interviewer_message=msg,
                current_question_index=session.current_question_index,
                total_questions=total_questions,
                is_completed=False,
            )
        else:
            now = datetime.now(timezone.utc)
            session.interview_status = "completed"
            session.status = "completed"
            session.ended_at = now
            msg = "That concludes our mock interview session. Your responses and transcript have been recorded."

            self.interview_repo.add_transcript(
                session_id=session.id,
                speaker="interviewer",
                message=msg,
                question_id=None,
                is_followup=False,
            )
            self.db.commit()

            return InterviewResponseResult(
                session_id=session.id,
                interview_status="completed",
                is_followup=False,
                current_question=None,
                interviewer_message=msg,
                current_question_index=session.current_question_index,
                total_questions=total_questions,
                is_completed=True,
            )

    def pause_interview(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewSession:
        session = self.get_session(session_id=session_id, user_id=user_id)
        if session.interview_status != "completed":
            session.interview_status = "paused"
            self.db.commit()
            self.db.refresh(session)
        return session

    def resume_interview(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewSession:
        session = self.get_session(session_id=session_id, user_id=user_id)
        if session.interview_status == "paused":
            session.interview_status = "active"
            self.db.commit()
            self.db.refresh(session)
        return session

    def end_interview(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewSession:
        session = self.get_session(session_id=session_id, user_id=user_id)
        now = datetime.now(timezone.utc)
        session.interview_status = "completed"
        session.status = "completed"
        if not session.ended_at:
            session.ended_at = now
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_runtime_state(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewRuntimeState:
        session = self.get_session(session_id=session_id, user_id=user_id)
        questions = self.interview_repo.get_questions_by_session(session_id=session_id)
        transcripts = self.interview_repo.get_transcripts_by_session(session_id=session_id)

        total_questions = len(questions)
        current_idx = session.current_question_index
        current_q = (
            questions[current_idx - 1]
            if (1 <= current_idx <= total_questions)
            else (questions[0] if total_questions > 0 else None)
        )

        return InterviewRuntimeState(
            session_id=session.id,
            interview_status=session.interview_status,
            started_at=session.started_at,
            ended_at=session.ended_at,
            current_question_index=session.current_question_index,
            total_questions=total_questions,
            current_question=QuestionRead.model_validate(current_q) if current_q else None,
            transcripts=[TranscriptRead.model_validate(t) for t in transcripts],
        )

    def get_transcripts(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[InterviewTranscript]:
        self.get_session(session_id=session_id, user_id=user_id)
        return self.interview_repo.get_transcripts_by_session(session_id=session_id)
