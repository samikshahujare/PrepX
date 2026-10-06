import json
import logging
from typing import Any, Dict, List, Optional
from app.adapters.interview_engine.base import BaseInterviewEngine, InterviewEngineResponse
from app.adapters.interview_engine.mock_engine import MockInterviewEngine
from app.models.interview import InterviewSession, Question
from app.services.llm_service import llm_service

logger = logging.getLogger("prepx.interview_engine")


class MultiLLMInterviewEngine(BaseInterviewEngine):
    """
    Sarah AI Interview Engine powered by centralized free Multi-LLM Service
    (Gemini -> NVIDIA NIM -> Groq -> OpenRouter) with automatic failover
    and semantic recruiter behavior determination.
    """

    def __init__(self):
        self.mock_fallback = MockInterviewEngine()

    def generate_initial_greeting(
        self, session: InterviewSession, first_question: Question
    ) -> str:
        prompt = (
            f"You are Sarah Jenkins, a Senior Technical Interviewer conducting a mock interview on PrepX.\n"
            f"Candidate domain: {session.domain}\n"
            f"Target company: {session.company or 'General Engineering'}\n"
            f"Difficulty: {session.difficulty}\n"
            f"First question to ask: {first_question.question_text}\n\n"
            f"Generate a professional, warm, concise opening greeting (2-3 sentences) introducing yourself as Sarah and transitioning naturally to the first question."
        )

        try:
            res = llm_service.generate(
                prompt=prompt,
                system_prompt="You are Sarah Jenkins, an AI Technical Interviewer at PrepX. Keep greeting professional, warm, and concise.",
                temperature=0.7,
                max_tokens=300,
            )
            if res.success and res.content:
                return res.content.strip()
        except Exception as e:
            logger.warning(f"MultiLLM greeting error: {e}")

        return self.mock_fallback.generate_initial_greeting(session, first_question)

    def process_candidate_response(
        self,
        session: InterviewSession,
        current_question: Optional[Question],
        candidate_response: str,
        conversation_history: List[Dict[str, Any]],
        next_question: Optional[Question],
    ) -> InterviewEngineResponse:
        system_prompt = (
            "You are Sarah Jenkins, a Senior Technical Interviewer at PrepX. "
            "You listen attentively, analyze technical substance, and decide whether to ask a sharp contextual follow-up or transition to the next question. "
            "You also output semantic facial/gestural state for the local 2D avatar. "
            "Output strictly valid JSON with no markdown wrapping."
        )

        recent_history = conversation_history[-4:] if conversation_history else []
        history_formatted = "\n".join([f"{h.get('speaker')}: {h.get('message')}" for h in recent_history])
        was_already_followup = False
        for item in reversed(conversation_history):
            if item.get("speaker") == "interviewer":
                was_already_followup = bool(item.get("is_followup", False))
                break

        followup_constraint = (
            "The candidate has just answered a follow-up question. You MUST NOT ask another follow-up for this question. "
            "Acknowledge the candidate's answer, provide brief feedback, transition to the next question (or wrap up if final question), and set is_followup to false."
            if was_already_followup else
            "If the answer is technically interesting but leaves an architectural trade-off or edge case open, you may formulate a concise follow-up question and set is_followup: true. Otherwise, transition to the next question with is_followup: false."
        )

        user_prompt = f"""Interview Context:
Domain: {session.domain}
Company: {session.company or 'General Engineering'}
Difficulty: {session.difficulty}

Recent Conversation:
{history_formatted}

Current Question: {current_question.question_text if current_question else 'None'}
Candidate's Answer: {candidate_response}
Next Question in Line: {next_question.question_text if next_question else 'None (Final Question)'}

Task:
1. Evaluate candidate answer quality (depth, correctness, specific engineering details).
2. Follow-up Policy: {followup_constraint}
3. If transitioning to next question or concluding, integrate next question or a warm wrap-up into interviewer_message.
4. Select semantic behavior for Sarah:
   - state: "SPEAKING", "ENCOURAGING", "SMILING", "CONCERNED", "NODDING", "COMPLETED"
   - emotion: "ENCOURAGING", "WARM_SMILE", "INTERESTED", "CONCERNED", "PROFESSIONAL_SERIOUS"
   - gesture: "NOD", "NOD_ENCOURAGING", "THINKING_TILT", "RESTING_DESK"

Output JSON Schema:
{{
  "interviewer_message": "Sarah's spoken response and next question/follow-up",
  "is_followup": boolean,
  "is_completed": boolean,
  "followup_question_text": "string or null",
  "state": "SPEAKING",
  "emotion": "ENCOURAGING|WARM_SMILE|INTERESTED|CONCERNED|PROFESSIONAL_SERIOUS",
  "gesture": "NOD|NOD_ENCOURAGING|THINKING_TILT|RESTING_DESK",
  "mouth": "SPEAKING"
}}
"""

        try:
            res = llm_service.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                json_mode=True,
                temperature=0.6,
                max_tokens=600,
            )

            if res.success and res.content:
                cleaned = res.content.replace("```json", "").replace("```", "").strip()
                data = json.loads(cleaned)
                is_followup = False if was_already_followup else bool(data.get("is_followup", False))
                is_completed = bool(data.get("is_completed", next_question is None and not is_followup))
                if next_question is None and not is_followup:
                    is_completed = True
                return InterviewEngineResponse(
                    interviewer_message=data.get("interviewer_message", ""),
                    is_followup=is_followup,
                    is_completed=is_completed,
                    followup_question_text=data.get("followup_question_text") if is_followup else None,
                    state=data.get("state", "SPEAKING"),
                    emotion=data.get("emotion", "NEUTRAL"),
                    gesture=data.get("gesture", "RESTING_DESK"),
                    mouth=data.get("mouth", "SPEAKING"),
                )
        except Exception as e:
            logger.warning(f"MultiLLM candidate response processing error: {e}")

        fallback_res = self.mock_fallback.process_candidate_response(
            session, current_question, candidate_response, conversation_history, next_question
        )
        return InterviewEngineResponse(
            interviewer_message=fallback_res.interviewer_message,
            is_followup=fallback_res.is_followup,
            is_completed=fallback_res.is_completed,
            followup_question_text=fallback_res.followup_question_text,
            state="SPEAKING",
            emotion="NEUTRAL",
            gesture="RESTING_DESK",
            mouth="SPEAKING",
        )
