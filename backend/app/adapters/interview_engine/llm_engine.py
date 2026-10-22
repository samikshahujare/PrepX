import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from app.adapters.interview_engine.base import BaseInterviewEngine, InterviewEngineResponse
from app.adapters.interview_engine.mock_engine import MockInterviewEngine
from app.models.interview import InterviewSession, Question
from app.services.llm_service import llm_service

logger = logging.getLogger("prepx.interview_engine")


class MultiLLMInterviewEngine(BaseInterviewEngine):
    """
    Sarah AI Interview Engine powered by centralized free Multi-LLM Service
    (Gemini -> NVIDIA NIM -> Groq -> OpenRouter) with automatic failover,
    candidate personalization, time-awareness, anti-hallucination safeguards,
    and structured answer quality evaluation.
    """

    def __init__(self):
        self.mock_fallback = MockInterviewEngine()

    def _determine_time_greeting(self, client_hour: Optional[int] = None) -> str:
        if client_hour is None:
            client_hour = datetime.now().hour

        if 5 <= client_hour < 12:
            return "Good morning"
        elif 12 <= client_hour < 17:
            return "Good afternoon"
        elif 17 <= client_hour < 22:
            return "Good evening"
        else:
            return "Good evening"

    def generate_initial_greeting(
        self, session: InterviewSession, first_question: Question, **kwargs: Any
    ) -> str:
        return self.mock_fallback.generate_initial_greeting(
            session=session, first_question=first_question, **kwargs
        )

    def process_candidate_response(
        self,
        session: InterviewSession,
        current_question: Optional[Question],
        candidate_response: str,
        conversation_history: List[Dict[str, Any]],
        next_question: Optional[Question],
        **kwargs: Any,
    ) -> InterviewEngineResponse:
        system_prompt = (
            "You are Sarah Jenkins, a Senior Technical Recruiter and Engineering Interviewer at PrepX. "
            "You listen attentively, analyze technical substance, correctness, and trade-offs. "
            "You behave like an experienced human interviewer: "
            "1. ONE CONCISE QUESTION PER TURN. Every interviewer question must be 1-2 sentences maximum. NEVER combine multiple questions into a single turn or paragraph. "
            "2. If candidate asks to repeat the question (e.g. 'What could you please?', 'Could you repeat that?'), set question_action: 'repeat', repeat the current question clearly, and DO NOT advance or change the topic. "
            "3. If candidate gives an empty or silent response, set question_action: 'repeat' and gently repeat the current question. "
            "4. If candidate gives a minimal one-word answer (e.g. 'yes', 'no', 'sure'), set question_action: 'clarify' and ask ONE concise clarification on the same topic. NEVER praise a one-word answer. "
            "5. If candidate states they don't know or haven't studied it, acknowledge neutrally and set question_action: 'next_topic'. "
            "6. If candidate gives a partial answer, set question_action: 'follow_up' and ask ONE relevant follow-up about their stated choice. "
            "7. If candidate gives a substantive, complete answer, acknowledge briefly and set question_action: 'next_topic' to move to the next planned question. "
            "8. Anti-Hallucination: Ground questions in candidate's actual resume facts and JD requirements provided. Never invent unmentioned projects or companies. "
            "Output strictly valid JSON with no markdown wrapping."
        )

        recent_history = conversation_history[-4:] if conversation_history else []
        history_formatted = "\n".join([f"{h.get('speaker')}: {h.get('message')}" for h in recent_history])
        was_already_followup = False
        for item in reversed(conversation_history):
            if item.get("speaker") == "interviewer":
                was_already_followup = bool(item.get("is_followup", False))
                break

        candidate_name = kwargs.get("candidate_name") or ""
        target_role = session.target_role or session.domain

        candidate_skills = kwargs.get("candidate_skills") or []
        candidate_projects = kwargs.get("candidate_projects") or []
        jd_required_skills = kwargs.get("jd_required_skills") or []
        jd_responsibilities = kwargs.get("jd_responsibilities") or []

        skills_str = ", ".join(candidate_skills[:10]) if candidate_skills else "General CS background"
        projects_str = ", ".join(candidate_projects[:4]) if candidate_projects else "None specified"
        jd_skills_str = ", ".join(jd_required_skills[:8]) if jd_required_skills else "General role requirements"
        jd_resp_str = "; ".join(jd_responsibilities[:2]) if jd_responsibilities else "Core role duties"

        user_prompt = f"""Interview Context:
Role / Domain: {target_role}
Company: {session.company or 'General Engineering'}
Difficulty: {session.difficulty}
Candidate: {candidate_name or 'Candidate'}
Candidate Resume Skills: {skills_str}
Candidate Resume Projects: {projects_str}
JD Key Skills: {jd_skills_str}
JD Responsibilities: {jd_resp_str}

Recent Conversation:
{history_formatted}

Current Question: {current_question.question_text if current_question else 'Tell me about yourself.'}
Candidate's Spoken Answer: {candidate_response}
Next Planned Question: {next_question.question_text if next_question else 'None (Final Question)'}
Was Last Turn Follow-up / Clarification: {was_already_followup}

Task & Decision Rules:
1. Identify Candidate Intent:
   - "repeat_request": Candidate didn't hear or asked to repeat (e.g. "What could you please?", "Could you repeat that?"). Action: set question_action="repeat", interviewer_message="Of course! [repeat current question]".
   - "empty_or_no_answer": Empty or silence. Action: set question_action="repeat".
   - "unable_to_answer": Stated unfamiliarity ("I don't know", "haven't studied that"). Action: set question_action="next_topic" with neutral acknowledgment.
   - "answer": Provided an answer. Check sufficiency:
     * "insufficient": One-word ("yes", "no") or non-answers. Action: set question_action="clarify", ask one concise clarification on the same topic. No praise!
     * "partial": Relevant but brief (e.g. "I used SMOTE"). If not already follow-up, set question_action="follow_up" and ask ONE concise follow-up about that choice.
     * "sufficient": Substantive, thorough answer. Set question_action="next_topic" (or 1 deeper follow-up).
2. Follow-up Policy:
   - If the candidate just answered a follow-up, you MUST NOT ask another follow-up for this question. Transition to the next topic (question_action="next_topic").
3. Question Form: ONE CONCISE PRIMARY QUESTION (1-2 sentences). Do NOT combine multiple sub-questions!

Output JSON Schema:
{{
  "intent": "answer|repeat_request|clarification_request|unable_to_answer",
  "answer_sufficiency": "empty|unclear|insufficient|partial|sufficient",
  "question_action": "repeat|clarify|follow_up|next_topic",
  "interviewer_message": "Sarah's spoken turn (concise question or acknowledgment + question)",
  "is_followup": boolean,
  "is_completed": boolean,
  "followup_question_text": "string or null",
  "state": "SPEAKING",
  "emotion": "WARM_SMILE|INTERESTED|CONCERNED|PROFESSIONAL_SERIOUS",
  "gesture": "RESTING_DESK|SPEAKING_EMPHASIS_RIGHT|EXPLAINING_OPEN_PALMS|THINKING_TILT",
  "mouth": "SPEAKING",
  "answer_quality": {{
    "score": 8.0,
    "relevance": "High|Medium|Low",
    "completeness": "Complete|Good|Partial|Incomplete",
    "technical_depth": "Deep|Solid|Surface|Weak",
    "needs_followup": boolean,
    "sentiment": "positive|neutral|concerned",
    "interviewer_action": "praise_and_advance|clarify|follow_up|repeat",
    "strengths": ["string"],
    "areas_for_improvement": ["string"]
  }}
}}
"""

        try:
            res = llm_service.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                json_mode=True,
                temperature=0.6,
                max_tokens=800,
            )

            if res.success and res.content:
                cleaned = res.content.replace("```json", "").replace("```", "").strip()
                data = json.loads(cleaned)
                question_action = data.get("question_action", "next_topic")
                is_followup = question_action in ["follow_up", "clarify"]
                if was_already_followup and question_action == "follow_up":
                    question_action = "next_topic"
                    is_followup = False

                is_completed = bool(data.get("is_completed", False))

                ans_quality = data.get("answer_quality")
                if not isinstance(ans_quality, dict):
                    ans_quality = None

                return InterviewEngineResponse(
                    interviewer_message=data.get("interviewer_message", ""),
                    is_followup=is_followup,
                    is_completed=is_completed,
                    followup_question_text=data.get("followup_question_text") if is_followup else None,
                    state=data.get("state", "SPEAKING"),
                    emotion=data.get("emotion", "INTERESTED"),
                    gesture=data.get("gesture", "RESTING_DESK"),
                    mouth=data.get("mouth", "SPEAKING"),
                    answer_quality=ans_quality,
                    question_action=question_action,
                    intent=data.get("intent", "answer"),
                    answer_sufficiency=data.get("answer_sufficiency", "sufficient"),
                )
        except Exception as e:
            logger.warning(f"MultiLLM candidate response processing error: {e}")

        return self.mock_fallback.process_candidate_response(
            session=session,
            current_question=current_question,
            candidate_response=candidate_response,
            conversation_history=conversation_history,
            next_question=next_question,
            **kwargs,
        )
