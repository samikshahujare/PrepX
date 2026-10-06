import re
from typing import Any, Dict, List, Optional
from app.adapters.interview_engine.base import BaseInterviewEngine, InterviewEngineResponse
from app.models.interview import InterviewSession, Question


class MockInterviewEngine(BaseInterviewEngine):
    """Deterministic, production-grade mock interviewer engine.
    
    Provides predictable yet natural conversational interview simulation without requiring external API keys.
    """

    def generate_initial_greeting(
        self, session: InterviewSession, first_question: Question
    ) -> str:
        company_phrase = f" at {session.company}" if session.company else ""
        return (
            f"Hello and welcome to your technical interview session for the {session.domain} role{company_phrase}. "
            f"I'm Sarah, your AI interviewer today. I'm excited to learn more about your experience and technical background. "
            f"Let's begin with our first question: {first_question.question_text}"
        )

    def process_candidate_response(
        self,
        session: InterviewSession,
        current_question: Optional[Question],
        candidate_response: str,
        conversation_history: List[Dict[str, Any]],
        next_question: Optional[Question],
    ) -> InterviewEngineResponse:
        cleaned_response = candidate_response.strip()

        # Check whether the most recent message before this response was already a follow-up question
        last_interviewer_msg = None
        for item in reversed(conversation_history):
            if item.get("speaker") == "interviewer":
                last_interviewer_msg = item
                break

        was_already_followup = bool(
            last_interviewer_msg and last_interviewer_msg.get("is_followup", False)
        )

        # Keyword-based deterministic follow-up logic
        tech_keywords = [
            "xgboost", "postgres", "postgresql", "react", "fastapi", "docker",
            "kubernetes", "redis", "kafka", "pipeline", "microservices", "sql",
            "python", "aws", "architecture", "cache", "model", "neural", "tree",
            "index", "security", "jwt", "testing", "async", "distributed"
        ]

        found_keyword = None
        for kw in tech_keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", cleaned_response, re.IGNORECASE):
                found_keyword = kw
                break

        should_ask_followup = (
            not was_already_followup
            and len(cleaned_response.split()) >= 4
            and (found_keyword is not None or "project" in cleaned_response.lower() or "built" in cleaned_response.lower())
        )

        if should_ask_followup:
            if found_keyword:
                followup_text = f"You highlighted utilizing {found_keyword.capitalize()}. Could you walk me through the key technical trade-offs or performance considerations you evaluated when implementing that?"
            else:
                followup_text = "That's a very clear overview. Could you dive a bit deeper into the primary technical challenges you encountered and how you solved them?"

            interviewer_msg = f"Thank you for sharing that context. {followup_text}"
            return InterviewEngineResponse(
                interviewer_message=interviewer_msg,
                is_followup=True,
                is_completed=False,
                followup_question_text=followup_text,
            )

        # Transition to next question or complete interview
        if next_question is not None:
            transition_phrases = [
                "Thank you for explaining that approach. Let's move to our next question: ",
                "Great insight. Moving forward, here is the next question: ",
                "Appreciate the detailed breakdown. Let's proceed: ",
            ]
            # Use deterministic index based on sequence
            phrase = transition_phrases[next_question.sequence_number % len(transition_phrases)]
            interviewer_msg = f"{phrase}{next_question.question_text}"

            return InterviewEngineResponse(
                interviewer_message=interviewer_msg,
                is_followup=False,
                is_completed=False,
                followup_question_text=None,
            )
        else:
            company_text = f" for {session.company}" if session.company else ""
            closing_msg = (
                f"Thank you so much for your thorough answers today. That concludes our mock interview session "
                f"for the {session.domain} position{company_text}. You've completed all questions, and your complete transcript has been saved."
            )
            return InterviewEngineResponse(
                interviewer_message=closing_msg,
                is_followup=False,
                is_completed=True,
                followup_question_text=None,
            )
