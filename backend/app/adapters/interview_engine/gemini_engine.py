import json
import logging
from typing import Any, Dict, List, Optional
from app.adapters.interview_engine.base import BaseInterviewEngine, InterviewEngineResponse
from app.adapters.interview_engine.mock_engine import MockInterviewEngine
from app.core.config import settings
from app.models.interview import InterviewSession, Question

logger = logging.getLogger(__name__)


class GeminiInterviewEngine(BaseInterviewEngine):
    """Gemini-powered interactive interview engine with automatic fallback."""

    def __init__(self):
        self.mock_fallback = MockInterviewEngine()

    def generate_initial_greeting(
        self, session: InterviewSession, first_question: Question
    ) -> str:
        if not settings.GEMINI_API_KEY:
            return self.mock_fallback.generate_initial_greeting(session, first_question)

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = (
                f"You are Sarah, a professional and encouraging technical interviewer at PrepX conducting a mock interview.\n"
                f"Candidate domain: {session.domain}\n"
                f"Target company: {session.company or 'General Engineering'}\n"
                f"Difficulty: {session.difficulty}\n"
                f"First question: {first_question.question_text}\n"
                f"Generate a friendly, concise opening greeting (2-3 sentences) introducing yourself and asking the first question."
            )
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini API greeting failed, falling back to mock: {e}")

        return self.mock_fallback.generate_initial_greeting(session, first_question)

    def process_candidate_response(
        self,
        session: InterviewSession,
        current_question: Optional[Question],
        candidate_response: str,
        conversation_history: List[Dict[str, Any]],
        next_question: Optional[Question],
    ) -> InterviewEngineResponse:
        if not settings.GEMINI_API_KEY:
            return self.mock_fallback.process_candidate_response(
                session, current_question, candidate_response, conversation_history, next_question
            )

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = (
                f"You are Sarah, a professional AI interviewer conducting a technical mock interview.\n"
                f"Domain: {session.domain}, Company: {session.company or 'Tech Company'}, Difficulty: {session.difficulty}\n"
                f"Current Question: {current_question.question_text if current_question else 'None'}\n"
                f"Candidate's Answer: {candidate_response}\n"
                f"Next Question (if applicable): {next_question.question_text if next_question else 'None (this was the last question)'}\n"
                f"Determine whether to ask a brief follow-up question or acknowledge and transition to the next question/wrap up.\n"
                f"Respond in JSON with schema:\n"
                f'{{"interviewer_message": "string", "is_followup": boolean, "is_completed": boolean, "followup_question_text": "string or null"}}'
            )
            response = model.generate_content(prompt)
            if response and response.text:
                cleaned = response.text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:-3].strip()
                elif cleaned.startswith("```"):
                    cleaned = cleaned[3:-3].strip()
                data = json.loads(cleaned)
                return InterviewEngineResponse(
                    interviewer_message=data.get("interviewer_message", ""),
                    is_followup=data.get("is_followup", False),
                    is_completed=data.get("is_completed", next_question is None),
                    followup_question_text=data.get("followup_question_text"),
                )
        except Exception as e:
            logger.warning(f"Gemini API response processing failed, falling back to mock: {e}")

        return self.mock_fallback.process_candidate_response(
            session, current_question, candidate_response, conversation_history, next_question
        )
