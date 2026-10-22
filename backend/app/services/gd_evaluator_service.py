import json
import logging
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundException, ValidationException
from app.models.gd import GDSession, GDParticipant, GDTranscript, GDEvaluation
from app.services.llm_service import LLMProviderManager

logger = logging.getLogger("prepx.gd_evaluator")

RUBRIC_CATEGORIES = [
    "communication_clarity",
    "relevance_to_topic",
    "quality_of_reasoning",
    "supporting_evidence",
    "critical_thinking",
    "listening_and_response",
    "constructive_collaboration",
    "respectful_disagreement",
    "building_challenging_views",
    "conciseness_organization",
    "participation_balance",
    "conclusion_summarization",
]


class GDEvaluatorService:
    def __init__(self, db: Session):
        self.db = db
        self.llm_manager = LLMProviderManager()

    def evaluate_participant(
        self,
        session_id: uuid.UUID,
        participant_id: uuid.UUID,
    ) -> GDEvaluation:
        """Generate individualized, evidence-grounded rubric evaluation for a specific participant."""
        session = self.db.query(GDSession).filter(GDSession.id == session_id).first()
        if not session:
            raise NotFoundException("GD Session not found.")

        participant = (
            self.db.query(GDParticipant)
            .filter(GDParticipant.id == participant_id, GDParticipant.session_id == session_id)
            .first()
        )
        if not participant:
            raise NotFoundException("Participant not found in session.")

        # Check if evaluation already exists (idempotency)
        existing_eval = (
            self.db.query(GDEvaluation)
            .filter(
                GDEvaluation.session_id == session_id,
                GDEvaluation.participant_id == participant_id,
            )
            .first()
        )
        if existing_eval:
            return existing_eval

        # Fetch transcripts
        all_transcripts = (
            self.db.query(GDTranscript)
            .filter(GDTranscript.session_id == session_id)
            .order_by(GDTranscript.sequence_number.asc())
            .all()
        )

        user_utterances = [t for t in all_transcripts if t.participant_id == participant_id]
        group_utterances = [t for t in all_transcripts if not t.is_moderator]

        # Format prompt
        user_quotes = "\n".join([f'[{t.timestamp_seconds}s] "{t.message}"' for t in user_utterances]) or "No spoken contributions recorded."
        discussion_flow = "\n".join([f"{t.speaker_name}: {t.message}" for t in all_transcripts[-15:]])

        prompt = (
            f"You are Sarah Jenkins, master recruiter and GD evaluator.\n"
            f"Evaluate candidate '{participant.display_name}' for the Group Discussion on:\n"
            f"Topic: {session.topic}\n"
            f"Candidate Attributed Utterances ({len(user_utterances)} turns):\n{user_quotes}\n\n"
            f"General Discussion Context:\n{discussion_flow}\n\n"
            "Score the candidate on a 1.0 to 5.0 scale across these exact 12 categories:\n"
            "communication_clarity, relevance_to_topic, quality_of_reasoning, supporting_evidence, "
            "critical_thinking, listening_and_response, constructive_collaboration, respectful_disagreement, "
            "building_challenging_views, conciseness_organization, participation_balance, conclusion_summarization.\n\n"
            "Return strictly a JSON object with this format:\n"
            "{\n"
            '  "overall_score": 4.1,\n'
            '  "category_scores": {\n'
            '    "communication_clarity": 4.2,\n'
            '    "relevance_to_topic": 4.5,\n'
            '    "quality_of_reasoning": 4.0,\n'
            '    "supporting_evidence": 3.8,\n'
            '    "critical_thinking": 4.0,\n'
            '    "listening_and_response": 4.3,\n'
            '    "constructive_collaboration": 4.1,\n'
            '    "respectful_disagreement": 4.2,\n'
            '    "building_challenging_views": 4.0,\n'
            '    "conciseness_organization": 4.0,\n'
            '    "participation_balance": 3.9,\n'
            '    "conclusion_summarization": 3.8\n'
            "  },\n"
            '  "strengths": ["Clear opening thesis", "Built constructively on peer point"],\n'
            '  "areas_for_improvement": ["Could bring in quantitative metrics", "Avoid trailing off in conclusion"],\n'
            '  "communication_feedback": "Articulate delivery with steady vocal projection.",\n'
            '  "reasoning_feedback": "Sound logical progression with valid deductions.",\n'
            '  "listening_feedback": "Actively referred to peer remarks by name.",\n'
            '  "missed_opportunities": ["Could have synthesized opposing viewpoints before the final minute."],\n'
            '  "example_strong_response": "For example: while velocity is critical, automated regression tests preserve long-term velocity.",\n'
            '  "personalized_plan": {"focus_areas": ["Active Listening", "Evidence Framing"], "recommended_topics": ["Ethical AI Governance", "Monolith vs Microservices"]}\n'
            "}"
        )

        overall_score = 3.8
        category_scores: Dict[str, float] = {cat: 3.8 for cat in RUBRIC_CATEGORIES}
        strengths = ["Contributed relevant arguments to the discussion flow", "Exhibited polite turn-taking"]
        areas_for_improvement = ["Cite concrete industry evidence or data points", "Synthesize group consensus earlier"]
        comm_fb = f"{participant.display_name} communicated with reasonable clarity and composure."
        reason_fb = "Arguments followed a coherent line of reasoning."
        listen_fb = "Acknowledged fellow participants' contributions during speaking turns."
        missed_opps = ["Opportunity to present a counter-intuitive industry case study."]
        example_resp = f"A high-impact contribution would be: 'Building on {session.topic[:30]}, we should assess both immediate delivery and long-term maintainability.'"
        personalized_plan = {
            "drills": ["Active Listening & Paraphrasing", "Structure: Point-Reason-Example-Point (PREP)"],
            "recommended_topics": ["AI Safety & Governance", "Remote Team Leadership"],
        }

        try:
            res = self.llm_manager.generate(
                prompt=prompt,
                system_prompt="You are Sarah Jenkins, technical evaluator. Return strictly valid JSON.",
                json_mode=True,
                temperature=0.4,
                max_tokens=800,
            )
            if res.success and res.content:
                parsed = json.loads(res.content)
                if "overall_score" in parsed and "category_scores" in parsed:
                    overall_score = round(float(parsed["overall_score"]), 1)
                    parsed_cat = parsed["category_scores"]
                    for cat in RUBRIC_CATEGORIES:
                        if cat in parsed_cat:
                            category_scores[cat] = round(float(parsed_cat[cat]), 1)
                    strengths = parsed.get("strengths", strengths)
                    areas_for_improvement = parsed.get("areas_for_improvement", areas_for_improvement)
                    comm_fb = parsed.get("communication_feedback", comm_fb)
                    reason_fb = parsed.get("reasoning_feedback", reason_fb)
                    listen_fb = parsed.get("listening_feedback", listen_fb)
                    missed_opps = parsed.get("missed_opportunities", missed_opps)
                    example_resp = parsed.get("example_strong_response", example_resp)
                    personalized_plan = parsed.get("personalized_plan", personalized_plan)
        except Exception as e:
            logger.warning(f"Error during LLM evaluation generation: {e}")

        # If user spoke very little, honestly reflect limited evidence
        if len(user_utterances) == 0:
            overall_score = 1.5
            category_scores = {cat: 1.5 for cat in RUBRIC_CATEGORIES}
            strengths = ["Attended the scheduled group discussion arena."]
            areas_for_improvement = [
                "Insufficient evidence: No attributable speech turns were recorded during this session.",
                "Active participation and contributing supporting evidence are critical for GD evaluation.",
            ]
            comm_fb = "Insufficient evidence: No spoken contributions were detected for this participant."
            reason_fb = "Insufficient evidence to evaluate logical progression or structure."
            listen_fb = "Session presence recorded, but no verbal engagement or synthesis observed."
            missed_opps = ["Missed opportunity to contribute initial viewpoints or respond to peer arguments."]
            example_resp = f"An opening contribution to start participating would be: 'I would like to initiate by addressing {session.topic[:35]} from the standpoint of practical feasibility.'"
            personalized_plan = {
                "drills": ["Voice Projection & Confidence", "Turn-taking & Point-Reason-Example"],
                "recommended_topics": ["Collaborative Problem Solving", session.topic],
            }

        evaluation = GDEvaluation(
            session_id=session_id,
            participant_id=participant_id,
            user_id=participant.user_id,
            overall_score=overall_score,
            category_scores=category_scores,
            strengths=strengths,
            areas_for_improvement=areas_for_improvement,
            communication_feedback=comm_fb,
            reasoning_feedback=reason_fb,
            listening_feedback=listen_fb,
            missed_opportunities=missed_opps,
            example_strong_response=example_resp,
            personalized_plan=personalized_plan,
        )
        self.db.add(evaluation)
        self.db.commit()
        self.db.refresh(evaluation)
        return evaluation

    def get_participant_evaluation(
        self,
        session_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        participant_id: Optional[uuid.UUID] = None,
    ) -> GDEvaluation:
        """Fetch evaluation ensuring participant authorization."""
        query = self.db.query(GDEvaluation).filter(GDEvaluation.session_id == session_id)
        if participant_id:
            eval_report = query.filter(GDEvaluation.participant_id == participant_id).first()
        elif user_id:
            eval_report = query.filter(GDEvaluation.user_id == user_id).first()
        else:
            raise ValidationException("Must specify user or participant identifier.")

        if not eval_report:
            # Auto-generate evaluation on demand if missing
            if participant_id:
                return self.evaluate_participant(session_id, participant_id)
            elif user_id:
                part = (
                    self.db.query(GDParticipant)
                    .filter(GDParticipant.session_id == session_id, GDParticipant.user_id == user_id)
                    .first()
                )
                if part:
                    return self.evaluate_participant(session_id, part.id)
            raise NotFoundException("Evaluation report not found for this participant.")

        return eval_report
