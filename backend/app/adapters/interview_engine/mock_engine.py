import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.adapters.interview_engine.base import BaseInterviewEngine, InterviewEngineResponse
from app.models.interview import InterviewSession, Question


class MockInterviewEngine(BaseInterviewEngine):
    """Deterministic, production-grade mock interviewer engine.
    
    Provides predictable, realistic, and personalized conversational interview simulation
    with time-awareness, candidate-awareness, and answer quality evaluation.
    """

    @staticmethod
    def _determine_time_greeting(client_hour: Optional[int] = None) -> str:
        if client_hour is None:
            # Fallback to local machine/current hour
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
        client_hour = kwargs.get("client_hour")
        time_greeting = self._determine_time_greeting(client_hour)
        candidate_name = kwargs.get("candidate_name")

        name_part = f" {candidate_name}" if candidate_name and candidate_name.strip() and candidate_name.strip().lower() not in ["candidate", "user", "there"] else ""
        company_phrase = f" at {session.company}" if session.company else ""
        role_phrase = f"the {session.target_role or session.domain} role{company_phrase}"

        return (
            f"{time_greeting}{name_part}! I'm Sarah Jenkins, your AI technical interviewer today at PrepX. "
            f"I'm looking forward to discussing your background for {role_phrase}. "
            f"Let's begin: Tell me about yourself."
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
        cleaned_response = candidate_response.strip()
        word_count = len(cleaned_response.split())
        current_q_text = current_question.question_text if current_question else "Tell me about yourself."

        # Check whether previous interviewer message was already a follow-up or clarification
        last_interviewer_msg = None
        for item in reversed(conversation_history):
            if item.get("speaker") == "interviewer":
                last_interviewer_msg = item
                break

        was_already_followup = bool(
            last_interviewer_msg and last_interviewer_msg.get("is_followup", False)
        )

        # 1. Handle Empty or Silence
        if not cleaned_response or word_count == 0:
            return InterviewEngineResponse(
                interviewer_message=f"Take your time. Whenever you're ready: {current_q_text}",
                is_followup=False,
                is_completed=False,
                followup_question_text=None,
                state="SPEAKING",
                emotion="NEUTRAL",
                gesture="RESTING_DESK",
                mouth="SPEAKING",
                question_action="repeat",
                intent="empty_or_no_answer",
                answer_sufficiency="empty",
                answer_quality={
                    "score": 3.0,
                    "relevance": "Low",
                    "completeness": "Incomplete",
                    "technical_depth": "Weak",
                    "needs_followup": False,
                    "sentiment": "neutral",
                    "interviewer_action": "repeat",
                    "feedback": "No answer recorded yet. Current question repeated.",
                    "strengths": [],
                    "areas_for_improvement": ["Please provide a spoken or typed response to proceed."],
                },
            )

        # 2. Handle Request for Repetition (e.g., "What could you please?", "Could you repeat that?", "Pardon?")
        repeat_patterns = [
            r"\bwhat could you please\b",
            r"\bcould you (?:please )?repeat\b",
            r"\bcan you (?:please )?repeat\b",
            r"\brepeat(?: the question| please| that)?\b",
            r"\bpardon(?: me)?\b",
            r"\bwhat did you say\b",
            r"\bsay that again\b",
            r"\bsay again\b",
            r"\bdidn't catch that\b",
            r"\bdid not catch that\b",
            r"\bdidn't hear that\b",
            r"\bdid not hear that\b",
            r"\bcome again\b",
        ]
        is_repeat_request = (
            any(re.search(pat, cleaned_response, re.IGNORECASE) for pat in repeat_patterns)
            or cleaned_response.lower().rstrip("?. ") in ["what", "pardon", "repeat", "could you please"]
        )

        if is_repeat_request:
            return InterviewEngineResponse(
                interviewer_message=f"Of course! {current_q_text}",
                is_followup=False,
                is_completed=False,
                followup_question_text=None,
                state="SPEAKING",
                emotion="INTERESTED",
                gesture="RESTING_DESK",
                mouth="SPEAKING",
                question_action="repeat",
                intent="repeat_request",
                answer_sufficiency="unclear",
                answer_quality={
                    "score": 5.0,
                    "relevance": "Medium",
                    "completeness": "Incomplete",
                    "technical_depth": "Weak",
                    "needs_followup": False,
                    "sentiment": "neutral",
                    "interviewer_action": "repeat",
                    "feedback": "Candidate requested question repetition. Kept current question active.",
                    "strengths": [],
                    "areas_for_improvement": [],
                },
            )

        # 3. Handle Explicit Unable to Answer (e.g., "I haven't studied that concept yet", "I don't know")
        unable_patterns = [
            r"\bhaven't studied\b",
            r"\bhave not studied\b",
            r"\bdon't know\b",
            r"\bdo not know\b",
            r"\bnot sure\b",
            r"\bhaven't worked with\b",
            r"\bhave not worked with\b",
            r"\bnot familiar with\b",
            r"\bpass on this\b",
            r"\bskip this\b",
        ]
        is_unable = any(re.search(pat, cleaned_response, re.IGNORECASE) for pat in unable_patterns)
        if is_unable:
            if next_question is not None:
                return InterviewEngineResponse(
                    interviewer_message=f"No problem at all. Let's move to our next question: {next_question.question_text}",
                    is_followup=False,
                    is_completed=False,
                    followup_question_text=None,
                    state="SPEAKING",
                    emotion="NEUTRAL",
                    gesture="RESTING_DESK",
                    mouth="SPEAKING",
                    question_action="next_topic",
                    intent="unable_to_answer",
                    answer_sufficiency="insufficient",
                    answer_quality={
                        "score": 4.5,
                        "relevance": "Low",
                        "completeness": "Incomplete",
                        "technical_depth": "Weak",
                        "needs_followup": False,
                        "sentiment": "neutral",
                        "interviewer_action": "advance_to_next",
                        "feedback": "Candidate stated unfamiliarity with the topic. Transitioned neutrally.",
                        "strengths": ["Honest technical self-assessment"],
                        "areas_for_improvement": ["Review fundamental concepts in this area."],
                    },
                )

        # 4. Handle Minimal / Insufficient Answer (e.g. "yes", "yeah", "no", "sure", word_count <= 2)
        minimal_words = {"yes", "yeah", "yep", "no", "sure", "ok", "okay", "i did", "we did", "right", "true"}
        is_minimal = word_count <= 2 or cleaned_response.lower().rstrip(".! ") in minimal_words

        if is_minimal:
            # Clarify without praise; keep on the same topic!
            clarify_question = "Could you elaborate on the specific tools, metrics, or approach you used?"
            return InterviewEngineResponse(
                interviewer_message=clarify_question,
                is_followup=True,
                is_completed=False,
                followup_question_text=clarify_question,
                state="SPEAKING",
                emotion="INTERESTED",
                gesture="RESTING_DESK",
                mouth="SPEAKING",
                question_action="clarify",
                intent="answer",
                answer_sufficiency="insufficient",
                answer_quality={
                    "score": 3.5,
                    "relevance": "Low",
                    "completeness": "Incomplete",
                    "technical_depth": "Weak",
                    "needs_followup": True,
                    "sentiment": "concerned",
                    "interviewer_action": "clarify",
                    "feedback": "Minimal single-word response. Requested technical clarification on the same topic.",
                    "strengths": [],
                    "areas_for_improvement": ["Elaborate with concrete technical details rather than a brief affirmation."],
                },
            )

        # 5. Extract Tech Keywords & Trade-off Signals
        tech_keywords = [
            "xgboost", "postgres", "postgresql", "react", "fastapi", "docker",
            "kubernetes", "redis", "kafka", "pipeline", "microservices", "sql",
            "python", "aws", "architecture", "cache", "model", "neural", "tree",
            "index", "security", "jwt", "testing", "async", "distributed", "pandas",
            "scikit-learn", "tensorflow", "pytorch", "ci/cd", "rest", "graphql", "smote"
        ]

        found_keywords = [
            kw for kw in tech_keywords
            if re.search(r"\b" + re.escape(kw) + r"\b", cleaned_response, re.IGNORECASE)
        ]

        has_tech = len(found_keywords) > 0
        has_metrics_or_tradeoffs = any(term in cleaned_response.lower() for term in [
            "because", "trade-off", "tradeoff", "latency", "scale", "performance",
            "imbalance", "accuracy", "precision", "recall", "cost", "tested", "designed"
        ])

        # 6. Classify Substantive vs Partial Answers
        if word_count >= 18 and (has_tech or has_metrics_or_tradeoffs):
            score = 8.5
            relevance = "High"
            completeness = "Complete"
            depth = "Deep"
            sentiment = "positive"
            avatar_emotion = "WARM_SMILE"
            sufficiency = "sufficient"
        elif (word_count >= 8 and has_tech) or (has_tech and word_count >= 3):
            score = 6.5 if word_count < 8 else 7.0
            relevance = "High"
            completeness = "Partial"
            depth = "Surface" if word_count < 8 else "Solid"
            sentiment = "positive"
            avatar_emotion = "INTERESTED"
            sufficiency = "partial"
        elif word_count >= 5:
            score = 5.5
            relevance = "Medium"
            completeness = "Partial"
            depth = "Surface"
            sentiment = "neutral"
            avatar_emotion = "INTERESTED"
            sufficiency = "partial"
        else:
            score = 4.0
            relevance = "Low"
            completeness = "Incomplete"
            depth = "Weak"
            sentiment = "concerned"
            avatar_emotion = "INTERESTED"
            sufficiency = "insufficient"

        evaluation_data = {
            "score": score,
            "relevance": relevance,
            "completeness": completeness,
            "technical_depth": depth,
            "needs_followup": not was_already_followup and (score < 6.5 or (has_tech and score < 8.0)),
            "sentiment": sentiment,
            "interviewer_action": "STRONG_ANSWER" if score >= 8.0 else ("WEAK_ANSWER" if score < 5.0 else "AVERAGE_ANSWER"),
            "feedback": (
                "Strong, well-structured answer with specific metrics and architectural depth."
                if score >= 8.0 else
                ("Solid response; consider elaborating on specific technical trade-offs." if score >= 6.0 else "Consider providing more concrete technical implementation details.")
            ),
            "strengths": [f"Demonstrated understanding of {kw.capitalize()}" for kw in found_keywords[:3]],
            "areas_for_improvement": ["Consider elaborating on production trade-offs and edge cases"] if not has_metrics_or_tradeoffs else [],
        }

        # 7. Adaptive Follow-up Decision (At most ONE concise follow-up per question)
        should_followup = not was_already_followup and (
            (has_tech and score < 8.0) or (score < 6.0 and word_count >= 3)
        )

        if should_followup:
            if found_keywords:
                primary_kw = found_keywords[0].capitalize()
                followup_text = f"Why did you choose {primary_kw} for that specific implementation?"
            elif "project" in cleaned_response.lower() or "built" in cleaned_response.lower():
                followup_text = "What was your specific personal contribution to that project?"
            else:
                followup_text = "What was the biggest technical challenge you encountered in that approach?"

            return InterviewEngineResponse(
                interviewer_message=followup_text,
                is_followup=True,
                is_completed=False,
                followup_question_text=followup_text,
                state="SPEAKING",
                emotion=avatar_emotion,
                gesture="RESTING_DESK",
                mouth="SPEAKING",
                question_action="follow_up",
                intent="answer",
                answer_sufficiency=sufficiency,
                answer_quality=evaluation_data,
            )

        # 8. Advance to Next Planned Question or Complete
        if next_question is not None:
            if score >= 8.0:
                praise_prefix = "Good explanation. "
            else:
                praise_prefix = "Thanks. "

            interviewer_msg = f"{praise_prefix}{next_question.question_text}"

            return InterviewEngineResponse(
                interviewer_message=interviewer_msg,
                is_followup=False,
                is_completed=False,
                followup_question_text=None,
                state="SPEAKING",
                emotion=avatar_emotion,
                gesture="RESTING_DESK",
                mouth="SPEAKING",
                question_action="next_topic",
                intent="answer",
                answer_sufficiency=sufficiency,
                answer_quality=evaluation_data,
            )
        else:
            is_final = kwargs.get("is_final_turn", False)
            if is_final:
                company_text = f" for {session.company}" if session.company else ""
                closing_msg = (
                    f"Thank you for sharing your background and answers today. That concludes our interview session "
                    f"for the {session.target_role or session.domain} position{company_text}. Your full transcript and feedback summary are now available."
                )
                return InterviewEngineResponse(
                    interviewer_message=closing_msg,
                    is_followup=False,
                    is_completed=True,
                    followup_question_text=None,
                    state="COMPLETED",
                    emotion="WARM_SMILE",
                    gesture="RESTING_DESK",
                    mouth="SPEAKING",
                    question_action="next_topic",
                    intent="answer",
                    answer_sufficiency=sufficiency,
                    answer_quality=evaluation_data,
                )
            else:
                return InterviewEngineResponse(
                    interviewer_message="Thank you for explaining that.",
                    is_followup=False,
                    is_completed=False,
                    followup_question_text=None,
                    state="SPEAKING",
                    emotion=avatar_emotion,
                    gesture="RESTING_DESK",
                    mouth="SPEAKING",
                    question_action="next_topic",
                    intent="answer",
                    answer_sufficiency=sufficiency,
                    answer_quality=evaluation_data,
                )
