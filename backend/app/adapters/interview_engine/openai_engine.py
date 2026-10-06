import json
import logging
from typing import Any, Dict, List, Optional
from app.adapters.interview_engine.base import BaseInterviewEngine, InterviewEngineResponse
from app.adapters.interview_engine.mock_engine import MockInterviewEngine
from app.core.config import settings
from app.models.interview import InterviewSession, Question

logger = logging.getLogger(__name__)


class OpenAIInterviewEngine(BaseInterviewEngine):
    """OpenAI-powered interactive interview engine with automatic fallback."""

    def __init__(self):
        self.mock_fallback = MockInterviewEngine()

    def generate_initial_greeting(
        self, session: InterviewSession, first_question: Question
    ) -> str:
        if not settings.OPENAI_API_KEY:
            return self.mock_fallback.generate_initial_greeting(session, first_question)

        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are Sarah, a professional and encouraging technical AI interviewer at PrepX.",
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Domain: {session.domain}, Company: {session.company or 'Tech'}\n"
                            f"First question: {first_question.question_text}\n"
                            f"Introduce yourself and ask this first question warmly and concisely."
                        ),
                    },
                ],
                temperature=0.7,
            )
            content = response.choices[0].message.content
            if content:
                return content.strip()
        except Exception as e:
            logger.warning(f"OpenAI greeting generation failed, falling back to mock: {e}")

        return self.mock_fallback.generate_initial_greeting(session, first_question)

    def process_candidate_response(
        self,
        session: InterviewSession,
        current_question: Optional[Question],
        candidate_response: str,
        conversation_history: List[Dict[str, Any]],
        next_question: Optional[Question],
    ) -> InterviewEngineResponse:
        if not settings.OPENAI_API_KEY:
            return self.mock_fallback.process_candidate_response(
                session, current_question, candidate_response, conversation_history, next_question
            )

        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are Sarah, a technical AI interviewer. Analyze candidate's response. "
                            "Decide if a brief follow-up question is warranted or transition to the next question. "
                            "Return valid JSON with keys: interviewer_message (string), is_followup (boolean), is_completed (boolean), followup_question_text (string or null)."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Domain: {session.domain}, Difficulty: {session.difficulty}\n"
                            f"Current Question: {current_question.question_text if current_question else 'None'}\n"
                            f"Candidate Response: {candidate_response}\n"
                            f"Next Question: {next_question.question_text if next_question else 'None (last question)'}\n"
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            content = response.choices[0].message.content
            if content:
                data = json.loads(content)
                return InterviewEngineResponse(
                    interviewer_message=data.get("interviewer_message", ""),
                    is_followup=data.get("is_followup", False),
                    is_completed=data.get("is_completed", next_question is None),
                    followup_question_text=data.get("followup_question_text"),
                )
        except Exception as e:
            logger.warning(f"OpenAI response processing failed, falling back to mock: {e}")

        return self.mock_fallback.process_candidate_response(
            session, current_question, candidate_response, conversation_history, next_question
        )
