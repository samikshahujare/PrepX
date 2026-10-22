import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class JDParseRequest(BaseModel):
    text: str = Field(..., min_length=10, description="Job description plain text")


class JDAnalysisResult(BaseModel):
    company: Optional[str] = None
    target_role: Optional[str] = None
    domain: str = "Software Engineering (Full Stack)"
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)
    qualifications: List[str] = Field(default_factory=list)
    experience_requirements: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    raw_text: str = ""


class QuestionRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    question_text: str
    category: str
    difficulty: str
    source: str
    sequence_number: int
    is_asked: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewSessionCreate(BaseModel):
    domain: str = Field(..., min_length=2, max_length=100, description="Target domain (e.g. Data Science, Web Development)")
    company: Optional[str] = Field(None, max_length=150, description="Target company name (e.g. Google, Microsoft)")
    target_role: Optional[str] = Field(None, max_length=150, description="Target role (e.g. Software Engineer, Data Analyst)")
    interview_mode: Literal["Company-Specific", "Role-Specific"] = Field("Role-Specific", description="Interview preparation mode")
    difficulty: Literal["Low", "Medium", "High"] = Field("Medium", description="Interview difficulty level")
    duration_minutes: int = Field(30, ge=15, le=120, description="Interview duration in minutes (15, 30, 45, 60)")
    allowed_attempts: int = Field(1, ge=1, le=5, description="Number of interview attempts allowed")
    resume_id: Optional[uuid.UUID] = Field(None, description="Linked resume UUID")
    job_description: Optional[str] = Field(None, description="Raw job description text")
    jd_analysis: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Extracted JD data")


class TranscriptRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    question_id: Optional[uuid.UUID] = None
    speaker: str  # interviewer, candidate, system
    message: str
    sequence_number: int
    is_followup: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewSessionRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    resume_id: Optional[uuid.UUID] = None
    domain: str
    company: Optional[str] = None
    target_role: Optional[str] = None
    interview_mode: str = "Role-Specific"
    difficulty: str
    duration_minutes: int = 30
    allowed_attempts: int = 1
    current_attempt: int = 1
    status: str
    interview_status: str = "idle"
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    current_question_index: int = 0
    job_description: Optional[str] = None
    jd_analysis: Dict[str, Any] = Field(default_factory=dict)
    paused_at: Optional[datetime] = None
    total_paused_seconds: int = 0
    feedback: Dict[str, Any] = Field(default_factory=dict)
    topic_coverage: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionRead] = Field(default_factory=list)
    transcripts: List[TranscriptRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class QuestionGenerateRequest(BaseModel):
    count: int = Field(5, ge=1, le=10, description="Number of questions to generate")


class AvatarSemanticBehavior(BaseModel):
    state: str = "SPEAKING"
    emotion: str = "NEUTRAL"
    gesture: str = "RESTING_DESK"
    mouth: str = "SPEAKING"


class AnswerQualityEvaluation(BaseModel):
    score: float = Field(7.0, ge=1.0, le=10.0, description="Overall answer quality score")
    relevance: str = Field("High", description="Relevance to the asked question")
    completeness: str = Field("Good", description="Completeness of technical explanation")
    technical_depth: str = Field("Solid", description="Demonstrated engineering depth")
    needs_followup: bool = Field(False, description="Whether question warrants contextual follow-up")
    sentiment: str = Field("positive", description="Evaluation sentiment: positive, neutral, concerned")
    interviewer_action: str = Field("praise_and_advance", description="Recommended recruiter action")
    strengths: List[str] = Field(default_factory=list, description="Key technical points answered well")
    areas_for_improvement: List[str] = Field(default_factory=list, description="Points that could be elaborated")


class InterviewStartRequest(BaseModel):
    client_local_time: Optional[str] = Field(None, description="ISO timestamp or local time string from client browser")
    client_timezone: Optional[str] = Field(None, description="Client timezone (e.g. America/New_York, Asia/Kolkata)")
    client_hour: Optional[int] = Field(None, ge=0, le=23, description="Client local hour 0-23")


class InterviewStartResponse(BaseModel):
    session_id: uuid.UUID
    interview_status: str
    current_question: Optional[QuestionRead] = None
    interviewer_message: str
    current_question_index: int
    total_questions: int
    started_at: datetime
    duration_minutes: int = 30
    deadline_at: Optional[datetime] = None
    remaining_seconds: Optional[int] = None
    behavior: Optional[AvatarSemanticBehavior] = None


class InterviewResponseRequest(BaseModel):
    candidate_response: str = Field(..., min_length=1, max_length=10000, description="Candidate's speech-to-text response")


class InterviewResponseResult(BaseModel):
    session_id: uuid.UUID
    interview_status: str  # active, completed, speaking, etc.
    is_followup: bool
    current_question: Optional[QuestionRead] = None
    interviewer_message: str
    current_question_index: int
    total_questions: int
    is_completed: bool
    duration_minutes: int = 30
    remaining_seconds: Optional[int] = None
    deadline_at: Optional[datetime] = None
    topic_coverage: Optional[Dict[str, Any]] = None
    behavior: Optional[AvatarSemanticBehavior] = None
    answer_quality: Optional[AnswerQualityEvaluation] = None
    question_action: Optional[str] = "next_topic"  # "repeat" | "clarify" | "follow_up" | "next_topic"
    intent: Optional[str] = "answer"  # "answer" | "repeat_request" | "clarification_request" | "unable_to_answer"
    answer_sufficiency: Optional[str] = "sufficient"  # "empty" | "unclear" | "insufficient" | "partial" | "sufficient"


class InterviewRuntimeState(BaseModel):
    session_id: uuid.UUID
    interview_status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_minutes: int = 30
    paused_at: Optional[datetime] = None
    total_paused_seconds: int = 0
    is_paused: bool = False
    remaining_seconds: int = 0
    deadline_at: Optional[datetime] = None
    current_question_index: int
    total_questions: int
    current_question: Optional[QuestionRead] = None
    transcripts: List[TranscriptRead] = Field(default_factory=list)
    feedback: Dict[str, Any] = Field(default_factory=dict)
    topic_coverage: Dict[str, Any] = Field(default_factory=dict)


class FeedbackSkillItem(BaseModel):
    skill: str
    importance: str = "High"
    what_to_learn: str
    why_it_matters: str
    what_was_misunderstood: str
    stronger_answer_guide: str
    suggested_practice_question: str


class InterviewFeedbackReport(BaseModel):
    overall_score: float = Field(..., ge=0.0, le=5.0)
    overall_explanation: str
    category_scores: Dict[str, float] = Field(default_factory=dict)
    category_assessments: Dict[str, str] = Field(default_factory=dict)
    strengths: List[str] = Field(default_factory=list)
    weaknesses_and_mistakes: List[str] = Field(default_factory=list)
    project_and_resume_evaluation: str
    skills_to_improve: List[FeedbackSkillItem] = Field(default_factory=list)
    better_answer_guidance: List[Dict[str, str]] = Field(default_factory=list)
    action_plan: List[str] = Field(default_factory=list)
    interview_summary: Dict[str, Any] = Field(default_factory=dict)
    is_preliminary: bool = False

