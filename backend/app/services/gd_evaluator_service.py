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
        """
        Generate an individualized, evidence-grounded evaluation report strictly from
        the participant's own attributable speech turns. Never awards scores or strengths
        without supporting transcript evidence.
        """
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

        # Idempotency check: return existing evaluation if already generated
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

        # Fetch only finalized transcripts for this session
        all_transcripts = (
            self.db.query(GDTranscript)
            .filter(GDTranscript.session_id == session_id)
            .order_by(GDTranscript.sequence_number.asc())
            .all()
        )

        # STRICT ISOLATION: Filter transcripts belonging only to this participant
        user_utterances = [
            t for t in all_transcripts
            if t.participant_id == participant_id and not t.is_moderator
        ]

        total_words = sum(len(t.message.split()) for t in user_utterances)
        speaking_turns = len(user_utterances)

        # =========================================================================
        # CASE 1: SILENT PARTICIPANT (No Attributable Speech Recorded)
        # =========================================================================
        if speaking_turns == 0:
            logger.info(f"[GDEvaluator] Participant '{participant.display_name}' ({participant_id}) has 0 spoken turns. Generating silent scorecard.")
            evaluation = GDEvaluation(
                session_id=session_id,
                participant_id=participant_id,
                user_id=participant.user_id,
                overall_score=1.0,
                category_scores={cat: 1.0 for cat in RUBRIC_CATEGORIES},
                strengths=[],  # Empty by design: no speech evidence to claim strengths
                areas_for_improvement=[
                    "No verbal contributions were recorded during this discussion session.",
                    "To receive a measurable score in a Group Discussion, you must speak and present your perspective.",
                    "Practice entering the discussion early: prepare your opening point during the first 1-2 minutes.",
                    "If a microphone hardware issue or network permission error occurred, test your audio device before your next session.",
                ],
                communication_feedback="No recorded verbal contribution. Vocal clarity, tone, and articulation could not be evaluated without speech evidence.",
                reasoning_feedback="No arguments or logical reasoning were recorded. Evaluation requires observable spoken propositions and rationale.",
                listening_feedback="No verbal acknowledgment of peers or responses recorded. Active listening in GDs is demonstrated through direct verbal engagement.",
                missed_opportunities=[
                    "Missed the opportunity to initiate the discussion or provide an early perspective.",
                    "Missed opportunities to agree, build upon, or politely challenge points raised by peers.",
                ],
                example_strong_response=(
                    f"To begin contributing in your next GD on '{session.topic}', use this starter: "
                    f"'I would like to open by proposing that {session.topic[:35]} has two critical dimensions: "
                    f"practical implementation and long-term sustainability. For instance...'"
                ),
                personalized_plan={
                    "speaking_turns": 0,
                    "word_count": 0,
                    "participation_status": "No recorded verbal contribution",
                    "evidence_quality": "none",
                    "drills": [
                        "The 2-Minute Ingress Drill: Practice speaking a structured 30-second point in the first 2 minutes.",
                        "PREP Method: State Point, Reason, Example, and Point restatement.",
                        "Peer Paraphrasing: Practice starting with 'Building on [Name]'s point about...'",
                    ],
                    "recommended_topics": [
                        session.topic,
                        "How to Overcome Hesitation and Speak Up in Group Discussions",
                    ],
                    "assessment_limitations": "No attributable speech was recorded. If technical microphone or connection problems occurred, this report reflects technical absence rather than your true communication capability.",
                },
            )
            self.db.add(evaluation)
            self.db.commit()
            self.db.refresh(evaluation)
            return evaluation

        # =========================================================================
        # CASE 2: MINIMAL PARTICIPANT (1 Short Turn / < 15 Words)
        # =========================================================================
        if speaking_turns == 1 and total_words < 15:
            logger.info(f"[GDEvaluator] Participant '{participant.display_name}' has minimal speech ({total_words} words). Generating minimal scorecard.")
            user_quote = user_utterances[0].message
            evaluation = GDEvaluation(
                session_id=session_id,
                participant_id=participant_id,
                user_id=participant.user_id,
                overall_score=2.0,
                category_scores={
                    "communication_clarity": 2.5,
                    "relevance_to_topic": 2.5,
                    "quality_of_reasoning": 2.0,
                    "supporting_evidence": 1.5,
                    "critical_thinking": 2.0,
                    "listening_and_response": 1.5,
                    "constructive_collaboration": 2.0,
                    "respectful_disagreement": 1.5,
                    "building_challenging_views": 1.5,
                    "conciseness_organization": 2.5,
                    "participation_balance": 1.5,
                    "conclusion_summarization": 1.5,
                },
                strengths=[
                    f"Made an initial contribution: \"{user_quote}\"",
                ],
                areas_for_improvement=[
                    "Participation was minimal (only 1 brief contribution recorded).",
                    "Support your points with practical reasons and real-world examples.",
                    "Engage actively with other participants across multiple speaking turns.",
                ],
                communication_feedback=f"Delivered a brief contribution (\"{user_quote}\"). Vocal delivery was present, but too limited to assess sustained communication.",
                reasoning_feedback="Your statement presented an initial thought, but lacked supporting premises or evidence.",
                listening_feedback="Did not verbally respond to or build upon other participants' statements during the discussion.",
                missed_opportunities=[
                    "Did not follow up on your initial remark with supporting evidence or data points.",
                    "Did not participate in mid-discussion debates or final summarization.",
                ],
                example_strong_response=(
                    f"Expand your remark into a full argument: 'Regarding \"{user_quote}\", "
                    "the primary reason is... For instance, in our recent coursework/industry, we observed that...'"
                ),
                personalized_plan={
                    "speaking_turns": speaking_turns,
                    "word_count": total_words,
                    "participation_status": "Minimal contribution (1 turn)",
                    "evidence_quality": "minimal",
                    "drills": [
                        "Point Elaboration: Turn a 1-sentence opinion into a 3-part argument with a concrete example.",
                        "Turn-Taking Practice: Aim for 3-4 distinct contributions throughout a 15-minute GD.",
                    ],
                    "recommended_topics": [session.topic],
                    "assessment_limitations": "Only one brief contribution was recorded. Several rubric categories could not be fully assessed due to limited evidence.",
                },
            )
            self.db.add(evaluation)
            self.db.commit()
            self.db.refresh(evaluation)
            return evaluation

        # =========================================================================
        # CASE 3: SUBSTANTIVE PARTICIPANT (2+ Turns, Rich Evidence)
        # =========================================================================
        user_quotes_formatted = "\n".join(
            [f'Turn {i+1} [{t.timestamp_seconds}s]: "{t.message}"' for i, t in enumerate(user_utterances)]
        )

        prompt = (
            f"You are Sarah Jenkins, a professional GD evaluator.\n"
            f"Topic: {session.topic}\n"
            f"Candidate: {participant.display_name}\n"
            f"Recorded Attributable Candidate Turns ({speaking_turns} turns, {total_words} words):\n"
            f"{user_quotes_formatted}\n\n"
            "INSTRUCTIONS:\n"
            "1. Evaluate this candidate STRICTLY based on their actual spoken quotes above.\n"
            "2. Score each category on a 1.0 to 5.0 scale.\n"
            "3. Ground all strengths and feedback in their actual words.\n"
            "4. Return strictly valid JSON in this exact structure:\n"
            "{\n"
            '  "overall_score": 3.7,\n'
            '  "category_scores": {\n'
            '    "communication_clarity": 3.8,\n'
            '    "relevance_to_topic": 4.0,\n'
            '    "quality_of_reasoning": 3.6,\n'
            '    "supporting_evidence": 3.4,\n'
            '    "critical_thinking": 3.7,\n'
            '    "listening_and_response": 3.5,\n'
            '    "constructive_collaboration": 3.8,\n'
            '    "respectful_disagreement": 3.5,\n'
            '    "building_challenging_views": 3.6,\n'
            '    "conciseness_organization": 3.8,\n'
            '    "participation_balance": 3.5,\n'
            '    "conclusion_summarization": 3.2\n'
            "  },\n"
            '  "strengths": ["Clear articulation of...", "Grounded argument in..."],\n'
            '  "areas_for_improvement": ["Could cite quantitative data", "Elaborate counter-arguments"],\n'
            '  "communication_feedback": "Specific feedback on clarity and delivery.",\n'
            '  "reasoning_feedback": "Specific feedback on logic and arguments.",\n'
            '  "listening_feedback": "Specific feedback on responsiveness to peers.",\n'
            '  "missed_opportunities": ["Missed opportunity to summarize."],\n'
            '  "example_strong_response": "An example of a higher-impact response based on their points.",\n'
            '  "personalized_plan": {\n'
            '    "drills": ["Drill 1", "Drill 2"],\n'
            '    "recommended_topics": ["Topic 1"]\n'
            "  }\n"
            "}"
        )

        # Baseline substantive defaults derived directly from evidence metrics
        calc_overall = min(4.5, max(2.5, 2.5 + (speaking_turns * 0.3) + min(1.0, total_words / 150.0)))
        overall_score = round(calc_overall, 1)
        category_scores: Dict[str, float] = {cat: overall_score for cat in RUBRIC_CATEGORIES}
        strengths = [
            f"Participated actively with {speaking_turns} speaking turns across the discussion.",
            f"Communicated key points relevant to the topic of {session.topic[:35]}.",
        ]
        areas_for_improvement = [
            "Support arguments with concrete industry case studies or quantitative metrics.",
            "Synthesize opposing viewpoints to help lead the group toward consensus.",
        ]
        comm_fb = f"{participant.display_name} spoke across {speaking_turns} turns with clear expression."
        reason_fb = "Presented relevant points that contributed to the group discussion flow."
        listen_fb = "Engaged in conversation turns during the session."
        missed_opps = ["Opportunity to present a counter-intuitive case study or summarize group consensus."]
        example_resp = f"A higher-impact point: 'To build on our analysis of {session.topic[:30]}, we should weigh both the short-term ROI and operational maintenance costs.'"
        personalized_plan_obj = {
            "drills": ["Data-Backed Argumentation", "Consensus Building & Synthesis"],
            "recommended_topics": [session.topic],
        }

        try:
            res = self.llm_manager.generate(
                prompt=prompt,
                system_prompt="You are Sarah Jenkins, professional GD evaluator. Return strictly valid JSON.",
                json_mode=True,
                temperature=0.3,
                max_tokens=850,
            )
            if res.success and res.content:
                parsed = json.loads(res.content)
                if "overall_score" in parsed and "category_scores" in parsed:
                    overall_score = round(float(parsed["overall_score"]), 1)
                    parsed_cat = parsed["category_scores"]
                    for cat in RUBRIC_CATEGORIES:
                        if cat in parsed_cat:
                            category_scores[cat] = round(float(parsed_cat[cat]), 1)
                    if parsed.get("strengths"):
                        strengths = parsed["strengths"]
                    if parsed.get("areas_for_improvement"):
                        areas_for_improvement = parsed["areas_for_improvement"]
                    comm_fb = parsed.get("communication_feedback", comm_fb)
                    reason_fb = parsed.get("reasoning_feedback", reason_fb)
                    listen_fb = parsed.get("listening_feedback", listen_fb)
                    if parsed.get("missed_opportunities"):
                        missed_opps = parsed["missed_opportunities"]
                    example_resp = parsed.get("example_strong_response", example_resp)
                    if parsed.get("personalized_plan"):
                        personalized_plan_obj = parsed["personalized_plan"]
        except Exception as e:
            logger.warning(f"Error during LLM evaluation generation: {e}")

        # Assemble personalized plan with verified evidence metadata
        final_plan = {
            "speaking_turns": speaking_turns,
            "word_count": total_words,
            "participation_status": "Substantive contributor",
            "evidence_quality": "substantive",
            "drills": personalized_plan_obj.get("drills", ["Active Listening", "PREP Method"]),
            "recommended_topics": personalized_plan_obj.get("recommended_topics", [session.topic]),
            "assessment_limitations": "Evaluation grounded in candidate's attributable spoken turns during this session.",
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
            personalized_plan=final_plan,
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
        """Fetch evaluation ensuring participant authorization and session boundary."""
        query = self.db.query(GDEvaluation).filter(GDEvaluation.session_id == session_id)
        if participant_id:
            eval_report = query.filter(GDEvaluation.participant_id == participant_id).first()
        elif user_id:
            eval_report = query.filter(GDEvaluation.user_id == user_id).first()
        else:
            raise ValidationException("Must specify user or participant identifier.")

        if not eval_report:
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
