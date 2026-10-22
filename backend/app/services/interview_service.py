import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.adapters.interview_engine.factory import get_interview_engine
from app.adapters.question_generator.factory import get_question_generator
from app.core.exceptions import PrepXException
from app.models.interview import InterviewSession, InterviewTranscript, Question
from app.repositories.interview_repository import InterviewRepository
from app.repositories.resume_repository import ResumeRepository
from app.schemas.interview import (
    AnswerQualityEvaluation,
    AvatarSemanticBehavior,
    InterviewResponseResult,
    InterviewRuntimeState,
    InterviewSessionCreate,
    InterviewStartResponse,
    QuestionRead,
    TranscriptRead,
)
from app.services.feedback_service import FeedbackService


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


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

    def _compute_deadline_and_remaining(
        self, session: InterviewSession
    ) -> tuple[Optional[datetime], int]:
        """
        Calculate authoritative server-side deadline and remaining seconds.
        Takes into account duration_minutes, started_at, total_paused_seconds, and active pauses.
        Safely normalizes timezone-naive and timezone-aware datetimes.
        """
        duration_mins = session.duration_minutes or 30
        duration_sec = duration_mins * 60
        paused_sec = session.total_paused_seconds or 0
        now = datetime.now(timezone.utc)

        started_at = ensure_utc(session.started_at)
        if not started_at:
            return None, duration_sec

        deadline_at = started_at + timedelta(seconds=duration_sec + paused_sec)

        if session.interview_status == "paused" and session.paused_at:
            paused_at = ensure_utc(session.paused_at) or now
            # During active pause, remaining time is frozen at the moment pause began
            remaining = max(0, int((deadline_at - paused_at).total_seconds()))
        elif session.interview_status == "completed":
            remaining = 0
        else:
            remaining = max(0, int((deadline_at - now).total_seconds()))

        return deadline_at, remaining

    def _build_initial_topic_plan(
        self,
        session: InterviewSession,
        candidate_skills: List[str],
        candidate_projects: List[str],
        candidate_experience: List[str],
        jd_required_skills: List[str],
        jd_responsibilities: List[str],
    ) -> Dict[str, Any]:
        """Build an internal topic-coverage plan across all candidate projects, skills, and JD requirements."""
        topics = [
            {"id": "opening", "type": "opening", "title": "Opening Introduction", "target": "Candidate Background", "category": "Opening"}
        ]

        # 1. Add all candidate resume projects
        for idx, proj in enumerate(candidate_projects):
            topics.append({
                "id": f"project_{idx+1}",
                "type": "resume_project",
                "title": f"Project: {proj}",
                "target": proj,
                "category": "Resume",
            })

        # 2. Add work experience / internship topics
        for idx, exp in enumerate(candidate_experience[:3]):
            topics.append({
                "id": f"experience_{idx+1}",
                "type": "experience",
                "title": f"Experience: {exp[:60]}",
                "target": exp,
                "category": "Resume",
            })

        # 3. Add core technical competencies from resume skills
        for idx, skill in enumerate(candidate_skills[:5]):
            topics.append({
                "id": f"tech_{idx+1}",
                "type": "technical_skill",
                "title": f"Technical Competency: {skill}",
                "target": skill,
                "category": "Technical",
            })

        # 4. Add JD required competencies and responsibilities
        for idx, jd_s in enumerate(jd_required_skills[:4]):
            topics.append({
                "id": f"jd_req_{idx+1}",
                "type": "jd_skill",
                "title": f"Role Requirement: {jd_s}",
                "target": jd_s,
                "category": "Domain",
            })

        for idx, resp in enumerate(jd_responsibilities[:2]):
            topics.append({
                "id": f"jd_resp_{idx+1}",
                "type": "jd_responsibility",
                "title": f"Key Responsibility: {resp[:60]}",
                "target": resp,
                "category": "Domain",
            })

        # 5. Add standard architectural, scenario, and behavioral challenges
        topics.extend([
            {"id": "concurrency_tradeoffs", "type": "scenario", "title": "High Concurrency & Data Consistency", "target": "Data Consistency", "category": "Technical"},
            {"id": "caching_bottlenecks", "type": "scenario", "title": "Caching Architecture & Production Latency", "target": "Caching Strategy", "category": "Domain"},
            {"id": "engineering_tradeoffs", "type": "tradeoff", "title": "Architectural Trade-offs & Past Redesigns", "target": "Trade-offs", "category": "Technical"},
            {"id": "team_collaboration", "type": "behavioral", "title": "Technical Disagreements & Collaboration", "target": "Collaboration", "category": "Behavioral"},
            {"id": "high_scale_10x", "type": "scale", "title": "10x System Scale Re-architecture", "target": "Scalability", "category": "Domain"},
        ])

        if session.company:
            topics.append({
                "id": "company_culture",
                "type": "company",
                "title": f"Alignment with {session.company} Engineering Principles",
                "target": session.company,
                "category": "Company",
            })

        return {
            "topics": topics,
            "covered_ids": [],
            "current_topic_id": "opening",
        }

    def generate_questions_for_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID, count: Optional[int] = None
    ) -> List[Question]:
        # 1. Fetch and validate session ownership
        session = self.get_session(session_id=session_id, user_id=user_id)

        # 2. Extract skills, projects, and experiences from linked resume if present
        candidate_skills = []
        candidate_projects = []
        candidate_experience = []
        if session.resume_id:
            resume = self.resume_repo.get_by_id(
                resume_id=session.resume_id, user_id=user_id
            )
            if resume and resume.profile:
                candidate_skills = resume.profile.skills or []
                candidate_projects = resume.profile.projects or []
                candidate_experience = resume.profile.experience or []

        # 3. Extract JD analysis details if present
        jd_required_skills = []
        jd_responsibilities = []
        if session.jd_analysis and isinstance(session.jd_analysis, dict):
            jd_required_skills = session.jd_analysis.get("required_skills", [])
            jd_responsibilities = session.jd_analysis.get("responsibilities", [])

        # 4. Calculate initial question batch size scaled to interview duration
        duration = session.duration_minutes or 30
        if count and count > 0:
            target_count = count
        elif duration <= 15:
            target_count = 10
        elif duration <= 30:
            target_count = 16
        elif duration <= 45:
            target_count = 22
        else:
            target_count = 28

        # 5. Build and save topic coverage plan
        coverage_plan = self._build_initial_topic_plan(
            session=session,
            candidate_skills=candidate_skills,
            candidate_projects=candidate_projects,
            candidate_experience=candidate_experience,
            jd_required_skills=jd_required_skills,
            jd_responsibilities=jd_responsibilities,
        )
        session.topic_coverage = coverage_plan

        # 6. Call Question Generator Provider
        generated_data = self.question_generator.generate_questions(
            domain=session.domain,
            difficulty=session.difficulty,
            company=session.company,
            candidate_skills=candidate_skills,
            candidate_projects=candidate_projects,
            count=target_count,
            target_role=session.target_role,
            interview_mode=session.interview_mode or "Role-Specific",
            duration_minutes=duration,
            jd_required_skills=jd_required_skills,
            jd_responsibilities=jd_responsibilities,
            job_description=session.job_description,
        )

        # Enforce that Question 1 is always strictly the fixed opening question
        if generated_data and len(generated_data) > 0:
            generated_data[0]["question_text"] = "Tell me about yourself."
            generated_data[0]["category"] = "Opening"

        # 7. Save generated questions in database
        saved_questions = self.interview_repo.save_questions(
            session_id=session.id, questions_data=generated_data
        )

        # 8. Update session status
        session.status = "ready"
        session.interview_status = "idle"
        session.current_question_index = 0
        self.db.commit()

        return saved_questions

    def _generate_dynamic_question(
        self,
        session: InterviewSession,
        candidate_skills: List[str],
        candidate_projects: List[str],
        candidate_experience: List[str],
        jd_required_skills: List[str],
        jd_responsibilities: List[str],
        sequence_num: int,
    ) -> Question:
        """
        Dynamically generate an additional high-priority question when existing questions are exhausted
        but interview time remains. Selects the next uncovered topic from the coverage tracker.
        """
        coverage = session.topic_coverage or {}
        topics = coverage.get("topics", [])
        covered_ids = set(coverage.get("covered_ids", []))

        # Find first uncovered topic
        next_topic = None
        for t in topics:
            if t["id"] not in covered_ids:
                next_topic = t
                break

        if not next_topic:
            # Fallback topics if all planned topics have been touched
            fallback_titles = [
                f"How do you design and execute integration and load tests for {session.domain} services?",
                "What is your approach to automated observability, distributed tracing, and alerting?",
                f"How do you resolve memory leaks or thread contention in {session.domain} applications?",
                "Tell me about a time you had to deliver a critical feature under a tight deadline."
            ]
            idx = sequence_num % len(fallback_titles)
            next_topic = {
                "id": f"fallback_{sequence_num}",
                "type": "scenario",
                "title": fallback_titles[idx],
                "target": "Engineering Fundamentals",
                "category": "Technical",
            }

        # Formulate concise question
        target_role = session.target_role or session.domain
        t_type = next_topic.get("type")
        target_val = next_topic.get("target")

        if t_type == "resume_project":
            q_text = f"Moving to your project work: Tell me about your technical implementation in {target_val}."
        elif t_type == "experience":
            q_text = f"Regarding your experience: Could you elaborate on your core responsibilities and accomplishments in {target_val[:60]}?"
        elif t_type == "technical_skill":
            q_text = f"How do you handle performance optimization and trade-offs when working with {target_val}?"
        elif t_type == "jd_skill":
            q_text = f"For this role's requirement of {target_val}, what has been your practical hands-on experience?"
        elif t_type == "company":
            q_text = f"How do your technical principles align with {session.company}'s engineering culture?"
        else:
            q_text = next_topic.get("title", f"How do you approach scalable system design in {target_role}?")

        # Update covered topics
        covered_ids.add(next_topic["id"])
        coverage["covered_ids"] = list(covered_ids)
        coverage["current_topic_id"] = next_topic["id"]
        session.topic_coverage = coverage

        # Save new question row in database
        new_q = Question(
            session_id=session.id,
            question_text=q_text,
            category=next_topic.get("category", "Technical"),
            difficulty=session.difficulty,
            source="ai_generated",
            sequence_number=sequence_num,
            is_asked=True,
        )
        self.db.add(new_q)
        self.db.commit()
        self.db.refresh(new_q)
        return new_q

    def get_session_questions(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[Question]:
        self.get_session(session_id=session_id, user_id=user_id)
        return self.interview_repo.get_questions_by_session(session_id=session_id)

    def _get_candidate_name(self, session: InterviewSession) -> str:
        if session.user and session.user.profile and session.user.profile.full_name:
            name = session.user.profile.full_name.strip()
            if name and name.lower() not in ["candidate", "user", "demo user", "demo-user"]:
                return name
        if session.resume and session.resume.profile and session.resume.profile.candidate_name:
            name = session.resume.profile.candidate_name.strip()
            if name and name.lower() not in ["candidate", "user"]:
                return name
        if session.user and session.user.email:
            import re
            user_part = session.user.email.split("@")[0]
            clean_name = " ".join([p.capitalize() for p in re.split(r"[\._-]", user_part) if p.isalpha()])
            if clean_name and clean_name.lower() not in ["candidate", "user", "admin"]:
                return clean_name
        return "there"

    def _resolve_client_hour(
        self,
        client_hour: Optional[int] = None,
        client_local_time: Optional[str] = None,
    ) -> int:
        if client_hour is not None and 0 <= client_hour <= 23:
            return client_hour
        if client_local_time:
            try:
                dt = datetime.fromisoformat(client_local_time.replace("Z", "+00:00"))
                return dt.hour
            except Exception:
                pass
        return datetime.now().hour

    def start_interview_runtime(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        client_local_time: Optional[str] = None,
        client_timezone: Optional[str] = None,
        client_hour: Optional[int] = None,
    ) -> InterviewStartResponse:
        session = self.get_session(session_id=session_id, user_id=user_id)

        # Ensure questions exist; if not, generate them scaled to duration
        questions = self.interview_repo.get_questions_by_session(session_id=session_id)
        if not questions:
            questions = self.generate_questions_for_session(session_id=session_id, user_id=user_id)

        first_question = questions[0]
        first_question.question_text = "Tell me about yourself."
        first_question.category = "Opening"
        first_question.is_asked = True

        now = datetime.now(timezone.utc)
        session.interview_status = "active"
        session.status = "in_progress"
        if not session.started_at:
            session.started_at = now
            session.total_paused_seconds = 0
            session.paused_at = None

        session.current_question_index = 1
        self.db.commit()

        deadline_at, remaining_seconds = self._compute_deadline_and_remaining(session)
        candidate_name = self._get_candidate_name(session)
        resolved_hour = self._resolve_client_hour(client_hour, client_local_time)

        existing_transcripts = self.interview_repo.get_transcripts_by_session(session_id=session_id)
        if not existing_transcripts:
            greeting_msg = self.interview_engine.generate_initial_greeting(
                session=session,
                first_question=first_question,
                candidate_name=candidate_name,
                client_hour=resolved_hour,
                client_timezone=client_timezone,
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
            duration_minutes=session.duration_minutes or 30,
            deadline_at=deadline_at,
            remaining_seconds=remaining_seconds,
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

        # 2. Extract structured resume profile & JD analysis
        candidate_skills = []
        candidate_projects = []
        candidate_experience = []
        candidate_education = []
        if session.resume_id:
            resume = self.resume_repo.get_by_id(
                resume_id=session.resume_id, user_id=user_id
            )
            if resume and resume.profile:
                candidate_skills = resume.profile.skills or []
                candidate_projects = resume.profile.projects or []
                candidate_experience = resume.profile.experience or []
                candidate_education = resume.profile.education or []

        jd_required_skills = []
        jd_responsibilities = []
        if session.jd_analysis and isinstance(session.jd_analysis, dict):
            jd_required_skills = session.jd_analysis.get("required_skills", [])
            jd_responsibilities = session.jd_analysis.get("responsibilities", [])

        # 3. Gather conversation history
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

        # 4. Check authoritative remaining duration
        deadline_at, remaining_seconds = self._compute_deadline_and_remaining(session)

        # Check if next question is available in initial batch
        next_question = (
            questions[current_idx] if (current_idx < total_questions) else None
        )

        candidate_name = self._get_candidate_name(session)

        # 5. Call AI Interview Engine to evaluate candidate response
        engine_res = self.interview_engine.process_candidate_response(
            session=session,
            current_question=current_question,
            candidate_response=candidate_response,
            conversation_history=history,
            next_question=next_question,
            candidate_name=candidate_name,
            candidate_skills=candidate_skills,
            candidate_projects=candidate_projects,
            candidate_experience=candidate_experience,
            candidate_education=candidate_education,
            jd_required_skills=jd_required_skills,
            jd_responsibilities=jd_responsibilities,
            job_description=session.job_description,
        )

        parsed_quality = None
        if engine_res.answer_quality and isinstance(engine_res.answer_quality, dict):
            try:
                parsed_quality = AnswerQualityEvaluation.model_validate(engine_res.answer_quality)
            except Exception:
                pass

        action = getattr(engine_res, "question_action", "next_topic")

        # A) REPEAT: Candidate asked to repeat or was silent. Re-ask same question.
        if action == "repeat":
            self.interview_repo.add_transcript(
                session_id=session.id,
                speaker="interviewer",
                message=engine_res.interviewer_message,
                question_id=current_question.id if current_question else None,
                is_followup=False,
            )
            self.db.commit()

            return InterviewResponseResult(
                session_id=session.id,
                interview_status=session.interview_status,
                is_followup=False,
                current_question=QuestionRead.model_validate(current_question) if current_question else None,
                interviewer_message=engine_res.interviewer_message,
                current_question_index=session.current_question_index,
                total_questions=total_questions,
                is_completed=False,
                duration_minutes=session.duration_minutes or 30,
                remaining_seconds=remaining_seconds,
                deadline_at=deadline_at,
                topic_coverage=session.topic_coverage,
                behavior=AvatarSemanticBehavior(
                    state=engine_res.state,
                    emotion=engine_res.emotion,
                    gesture=engine_res.gesture,
                    mouth=engine_res.mouth,
                ),
                answer_quality=parsed_quality,
                question_action="repeat",
                intent=getattr(engine_res, "intent", "repeat_request"),
                answer_sufficiency=getattr(engine_res, "answer_sufficiency", "unclear"),
            )

        # B) CLARIFY or FOLLOW_UP: Candidate gave brief/partial answer. Ask 1 concise follow-up.
        if (action in ["clarify", "follow_up"] or engine_res.is_followup) and remaining_seconds > 60:
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
                duration_minutes=session.duration_minutes or 30,
                remaining_seconds=remaining_seconds,
                deadline_at=deadline_at,
                topic_coverage=session.topic_coverage,
                behavior=AvatarSemanticBehavior(
                    state=engine_res.state,
                    emotion=engine_res.emotion,
                    gesture=engine_res.gesture,
                    mouth=engine_res.mouth,
                ),
                answer_quality=parsed_quality,
                question_action=action,
                intent=getattr(engine_res, "intent", "answer"),
                answer_sufficiency=getattr(engine_res, "answer_sufficiency", "partial"),
            )

        # C) NEXT TOPIC: Candidate answered. Check whether duration allows another question!
        # DURATION RULE: If more than 90 seconds remain, DO NOT prematurely end the interview!
        if remaining_seconds > 90:
            if next_question is None:
                # DYNAMIC QUESTION GENERATION: Initial question list exhausted, but time remains!
                next_question = self._generate_dynamic_question(
                    session=session,
                    candidate_skills=candidate_skills,
                    candidate_projects=candidate_projects,
                    candidate_experience=candidate_experience,
                    jd_required_skills=jd_required_skills,
                    jd_responsibilities=jd_responsibilities,
                    sequence_num=total_questions + 1,
                )
                total_questions += 1

            session.current_question_index += 1
            next_question.is_asked = True

            # Use engine message or directly present next question
            speaker_msg = engine_res.interviewer_message
            if not speaker_msg or "concludes our interview" in speaker_msg.lower():
                speaker_msg = f"Thank you. {next_question.question_text}"

            self.interview_repo.add_transcript(
                session_id=session.id,
                speaker="interviewer",
                message=speaker_msg,
                question_id=next_question.id,
                is_followup=False,
            )
            self.db.commit()

            return InterviewResponseResult(
                session_id=session.id,
                interview_status=session.interview_status,
                is_followup=False,
                current_question=QuestionRead.model_validate(next_question),
                interviewer_message=speaker_msg,
                current_question_index=session.current_question_index,
                total_questions=total_questions,
                is_completed=False,
                duration_minutes=session.duration_minutes or 30,
                remaining_seconds=remaining_seconds,
                deadline_at=deadline_at,
                topic_coverage=session.topic_coverage,
                behavior=AvatarSemanticBehavior(
                    state=engine_res.state,
                    emotion=engine_res.emotion,
                    gesture=engine_res.gesture,
                    mouth=engine_res.mouth,
                ),
                answer_quality=parsed_quality,
                question_action="next_topic",
                intent=getattr(engine_res, "intent", "answer"),
                answer_sufficiency=getattr(engine_res, "answer_sufficiency", "sufficient"),
            )

        # D) TIME BUDGET REACHED: Graceful conclusion & feedback generation
        now = datetime.now(timezone.utc)
        session.interview_status = "completed"
        session.status = "completed"
        session.ended_at = now

        company_text = f" for {session.company}" if session.company else ""
        closing_msg = (
            f"Thank you for sharing your background and technical answers today. That concludes our interview session "
            f"for the {session.target_role or session.domain} position{company_text}. Your full transcript and feedback summary are now available."
        )

        self.interview_repo.add_transcript(
            session_id=session.id,
            speaker="interviewer",
            message=closing_msg,
            question_id=None,
            is_followup=False,
        )

        # Automatically generate and persist comprehensive post-interview feedback
        self._ensure_feedback_generated(session, user_id)

        self.db.commit()

        return InterviewResponseResult(
            session_id=session.id,
            interview_status="completed",
            is_followup=False,
            current_question=None,
            interviewer_message=closing_msg,
            current_question_index=session.current_question_index,
            total_questions=total_questions,
            is_completed=True,
            duration_minutes=session.duration_minutes or 30,
            remaining_seconds=0,
            deadline_at=deadline_at,
            topic_coverage=session.topic_coverage,
            behavior=AvatarSemanticBehavior(
                state="COMPLETED",
                emotion="WARM_SMILE",
                gesture="RESTING_DESK",
                mouth="SPEAKING",
            ),
            answer_quality=parsed_quality,
            question_action="next_topic",
            intent=getattr(engine_res, "intent", "answer"),
            answer_sufficiency=getattr(engine_res, "answer_sufficiency", "sufficient"),
        )

    def advance_to_next_question(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewResponseResult:
        session = self.get_session(session_id=session_id, user_id=user_id)
        questions = self.interview_repo.get_questions_by_session(session_id=session_id)
        total_questions = len(questions)

        deadline_at, remaining_seconds = self._compute_deadline_and_remaining(session)
        current_idx = session.current_question_index

        if current_idx < total_questions:
            session.current_question_index += 1
            next_q = questions[session.current_question_index - 1]
            next_q.is_asked = True
            msg = f"Skipping to the next question: {next_q.question_text}"
        elif remaining_seconds > 90:
            # Dynamically generate if time remains
            candidate_skills = []
            candidate_projects = []
            candidate_experience = []
            if session.resume_id:
                resume = self.resume_repo.get_by_id(resume_id=session.resume_id, user_id=user_id)
                if resume and resume.profile:
                    candidate_skills = resume.profile.skills or []
                    candidate_projects = resume.profile.projects or []
                    candidate_experience = resume.profile.experience or []

            jd_skills = session.jd_analysis.get("required_skills", []) if isinstance(session.jd_analysis, dict) else []
            jd_resp = session.jd_analysis.get("responsibilities", []) if isinstance(session.jd_analysis, dict) else []

            next_q = self._generate_dynamic_question(
                session=session,
                candidate_skills=candidate_skills,
                candidate_projects=candidate_projects,
                candidate_experience=candidate_experience,
                jd_required_skills=jd_skills,
                jd_responsibilities=jd_resp,
                sequence_num=total_questions + 1,
            )
            session.current_question_index += 1
            total_questions += 1
            msg = f"Moving to: {next_q.question_text}"
        else:
            now = datetime.now(timezone.utc)
            session.interview_status = "completed"
            session.status = "completed"
            session.ended_at = now
            msg = "That concludes our mock interview session. Your responses and feedback summary are now available."

            self._ensure_feedback_generated(session, user_id)
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
                duration_minutes=session.duration_minutes or 30,
                remaining_seconds=0,
                deadline_at=deadline_at,
            )

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
            duration_minutes=session.duration_minutes or 30,
            remaining_seconds=remaining_seconds,
            deadline_at=deadline_at,
        )

    def pause_interview(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewSession:
        session = self.get_session(session_id=session_id, user_id=user_id)
        if session.interview_status != "completed":
            now = datetime.now(timezone.utc)
            session.interview_status = "paused"
            session.paused_at = now
            self.db.commit()
            self.db.refresh(session)
        return session

    def resume_interview(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewSession:
        session = self.get_session(session_id=session_id, user_id=user_id)
        if session.interview_status == "paused":
            now = datetime.now(timezone.utc)
            if session.paused_at:
                paused_at = ensure_utc(session.paused_at)
                paused_delta = int((now - paused_at).total_seconds()) if paused_at else 0
                session.total_paused_seconds = (session.total_paused_seconds or 0) + max(0, paused_delta)
                session.paused_at = None
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

        # Generate and persist comprehensive post-interview feedback
        self._ensure_feedback_generated(session, user_id)

        self.db.commit()
        self.db.refresh(session)
        return session

    def _ensure_feedback_generated(self, session: InterviewSession, user_id: uuid.UUID) -> Dict[str, Any]:
        """Idempotently generates and persists the full 9-section feedback report."""
        if session.feedback and isinstance(session.feedback, dict) and session.feedback.get("overall_score") is not None:
            return session.feedback

        transcripts = self.interview_repo.get_transcripts_by_session(session_id=session.id)
        questions = self.interview_repo.get_questions_by_session(session_id=session.id)

        candidate_skills = []
        candidate_projects = []
        if session.resume_id:
            resume = self.resume_repo.get_by_id(resume_id=session.resume_id, user_id=user_id)
            if resume and resume.profile:
                candidate_skills = resume.profile.skills or []
                candidate_projects = resume.profile.projects or []

        jd_required_skills = []
        jd_responsibilities = []
        if session.jd_analysis and isinstance(session.jd_analysis, dict):
            jd_required_skills = session.jd_analysis.get("required_skills", [])
            jd_responsibilities = session.jd_analysis.get("responsibilities", [])

        report = FeedbackService.generate_feedback_report(
            session=session,
            transcripts=transcripts,
            questions=questions,
            candidate_skills=candidate_skills,
            candidate_projects=candidate_projects,
            jd_required_skills=jd_required_skills,
            jd_responsibilities=jd_responsibilities,
        )
        session.feedback = report
        self.db.commit()
        return report

    def get_runtime_state(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> InterviewRuntimeState:
        session = self.get_session(session_id=session_id, user_id=user_id)
        questions = self.interview_repo.get_questions_by_session(session_id=session_id)
        transcripts = self.interview_repo.get_transcripts_by_session(session_id=session_id)

        deadline_at, remaining_seconds = self._compute_deadline_and_remaining(session)

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
            duration_minutes=session.duration_minutes or 30,
            paused_at=session.paused_at,
            total_paused_seconds=session.total_paused_seconds or 0,
            is_paused=session.interview_status == "paused",
            remaining_seconds=remaining_seconds,
            deadline_at=deadline_at,
            current_question_index=session.current_question_index,
            total_questions=total_questions,
            current_question=QuestionRead.model_validate(current_q) if current_q else None,
            transcripts=[TranscriptRead.model_validate(t) for t in transcripts],
            feedback=session.feedback or {},
            topic_coverage=session.topic_coverage or {},
        )

    def get_transcripts(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[InterviewTranscript]:
        self.get_session(session_id=session_id, user_id=user_id)
        return self.interview_repo.get_transcripts_by_session(session_id=session_id)

    def get_feedback(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> Dict[str, Any]:
        session = self.get_session(session_id=session_id, user_id=user_id)
        return self._ensure_feedback_generated(session, user_id)
