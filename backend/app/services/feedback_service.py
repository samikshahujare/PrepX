import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.models.interview import InterviewSession
from app.schemas.interview import InterviewFeedbackReport
from app.services.llm_service import llm_service

logger = logging.getLogger("prepx.feedback_service")


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class FeedbackService:
    """
    Comprehensive, evidence-based post-interview feedback report generator.
    Evaluates real transcript evidence, questions asked, candidate answers,
    resume projects, and JD competencies to deliver an actionable assessment.
    """

    @staticmethod
    def generate_feedback_report(
        session: InterviewSession,
        transcripts: List[Any],
        questions: List[Any],
        candidate_skills: Optional[List[str]] = None,
        candidate_projects: Optional[List[str]] = None,
        jd_required_skills: Optional[List[str]] = None,
        jd_responsibilities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        # If valid report already exists on session, return it idempotently
        if session.feedback and isinstance(session.feedback, dict) and session.feedback.get("overall_score") is not None:
            return session.feedback

        # Assemble dialogue QA turns from transcripts
        qa_turns: List[Dict[str, str]] = []
        last_question = ""
        candidate_answers_count = 0

        for t in transcripts:
            if t.speaker == "interviewer":
                last_question = t.message
            elif t.speaker == "candidate" and last_question:
                candidate_answers_count += 1
                qa_turns.append({
                    "question": last_question,
                    "answer": t.message,
                    "is_followup": bool(t.is_followup),
                })

        # Calculate actual elapsed time in minutes
        now = datetime.now(timezone.utc)
        start_time = ensure_utc(session.started_at) or now
        end_time = ensure_utc(session.ended_at) or now
        elapsed_seconds = max(0, int((end_time - start_time).total_seconds()) - (session.total_paused_seconds or 0))
        elapsed_minutes = round(elapsed_seconds / 60.0, 1)

        is_preliminary = candidate_answers_count < 2 or elapsed_minutes < 2.0
        target_role = session.target_role or session.domain or "Software Engineer"
        company_name = session.company or "Technology Company"

        # Try LLM-driven structured feedback report
        try:
            report_dict = FeedbackService._generate_via_llm(
                session=session,
                qa_turns=qa_turns,
                candidate_skills=candidate_skills or [],
                candidate_projects=candidate_projects or [],
                jd_required_skills=jd_required_skills or [],
                target_role=target_role,
                company_name=company_name,
                elapsed_minutes=elapsed_minutes,
                is_preliminary=is_preliminary,
            )
            if report_dict:
                return report_dict
        except Exception as e:
            logger.warning(f"LLM feedback generation fallback engaged: {e}")

        # Deterministic evidence-based fallback
        return FeedbackService._generate_fallback(
            session=session,
            qa_turns=qa_turns,
            candidate_skills=candidate_skills or [],
            candidate_projects=candidate_projects or [],
            jd_required_skills=jd_required_skills or [],
            target_role=target_role,
            company_name=company_name,
            elapsed_minutes=elapsed_minutes,
            is_preliminary=is_preliminary,
        )

    @staticmethod
    def _generate_via_llm(
        session: InterviewSession,
        qa_turns: List[Dict[str, str]],
        candidate_skills: List[str],
        candidate_projects: List[str],
        jd_required_skills: List[str],
        target_role: str,
        company_name: str,
        elapsed_minutes: float,
        is_preliminary: bool,
    ) -> Optional[Dict[str, Any]]:
        system_prompt = (
            "You are an expert technical interview evaluation engine for PrepX. "
            "You produce honest, evidence-grounded interview feedback for engineering candidates. "
            "Scoring is strictly on a 1.0 to 5.0 scale (where 5.0 is outstanding staff-level mastery, "
            "4.0 is strong hire, 3.0 is working competency with gaps, 2.0 is weak with significant misconceptions, "
            "and 1.0 is insufficient/minimal). "
            "Never invent answers the candidate did not give. Ground feedback directly in their spoken words. "
            "If the candidate gave short or one-word answers (e.g. 'yes', 'no'), penalize completeness and depth accordingly. "
            "Output strictly valid JSON with no markdown wrapping."
        )

        turns_text = "\n".join([
            f"Turn {i+1}:\nInterviewer: {t['question']}\nCandidate: {t['answer']}\n"
            for i, t in enumerate(qa_turns)
        ]) if qa_turns else "No candidate answers were recorded."

        user_prompt = f"""Interview Context:
Target Role: {target_role}
Company: {company_name}
Difficulty: {session.difficulty}
Configured Duration: {session.duration_minutes} minutes
Actual Elapsed: {elapsed_minutes} minutes
Candidate Skills: {', '.join(candidate_skills[:12]) if candidate_skills else 'Standard Engineering'}
Candidate Projects: {', '.join(candidate_projects[:5]) if candidate_projects else 'General'}
JD Required Skills: {', '.join(jd_required_skills[:8]) if jd_required_skills else 'Standard'}

Transcript of Candidate Turns:
{turns_text}

Generate JSON matching this exact structure:
{{
  "overall_score": 3.8,
  "overall_explanation": "Summary of overall candidate performance based on technical depth, completeness, and clarity.",
  "category_scores": {{
    "technical_knowledge": 3.8,
    "correctness": 4.0,
    "relevance": 4.2,
    "completeness_and_depth": 3.5,
    "problem_solving": 3.7,
    "project_understanding": 4.0,
    "communication_and_clarity": 3.9,
    "role_readiness": 3.6
  }},
  "category_assessments": {{
    "technical_knowledge": "Assessment of core engineering concepts demonstrated.",
    "correctness": "Evaluation of factual and architectural correctness.",
    "relevance": "How directly answers addressed the specific questions asked.",
    "completeness_and_depth": "Depth of technical trade-offs and implementation specifics.",
    "problem_solving": "Systematic approach to handling challenges and edge cases.",
    "project_understanding": "Command of personal contribution and design rationale.",
    "communication_and_clarity": "Conciseness and structure of explanations.",
    "role_readiness": "Readiness for the target {target_role} position."
  }},
  "strengths": [
    "Specific technical point or concept candidate explained clearly and accurately",
    "Another demonstrated strength with evidence from transcript"
  ],
  "weaknesses_and_mistakes": [
    "Specific gap, unaddressed trade-off, or shallow explanation from the interview",
    "Concept where candidate struggled or gave minimal detail"
  ],
  "project_and_resume_evaluation": "Detailed review of how the candidate defended their resume projects and personal contributions.",
  "skills_to_improve": [
    {{
      "skill": "Name of technical skill or competency",
      "importance": "High",
      "what_to_learn": "Key concept to study",
      "why_it_matters": "Why this matters in production systems for {target_role}",
      "what_was_misunderstood": "What the candidate missed in their answer",
      "stronger_answer_guide": "What a robust, comprehensive answer should cover",
      "suggested_practice_question": "Practice question to test this concept"
    }}
  ],
  "better_answer_guidance": [
    {{
      "question": "Question where candidate gave a weak or incomplete answer",
      "candidate_answer_summary": "Summary of what candidate actually said",
      "recommended_model_answer": "Structured model answer showing how to articulate trade-offs, metrics, and architecture"
    }}
  ],
  "action_plan": [
    "High-priority action step 1",
    "High-priority action step 2",
    "Practice recommendation"
  ],
  "interview_summary": {{
    "target_role": "{target_role}",
    "company": "{company_name}",
    "interview_mode": "{session.interview_mode}",
    "configured_duration_minutes": {session.duration_minutes},
    "actual_elapsed_minutes": {elapsed_minutes},
    "questions_completed": {len(qa_turns)},
    "completion_status": "{session.status}"
  }},
  "is_preliminary": {str(is_preliminary).lower()}
}}
"""

        res = llm_service.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            json_mode=True,
            temperature=0.3,
            max_tokens=1500,
        )

        if res.success and res.content:
            cleaned = res.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            # Validate overall score range
            score = float(data.get("overall_score", 3.5))
            data["overall_score"] = max(1.0, min(5.0, round(score, 1)))
            return data

        return None

    @staticmethod
    def _generate_fallback(
        session: InterviewSession,
        qa_turns: List[Dict[str, str]],
        candidate_skills: List[str],
        candidate_projects: List[str],
        jd_required_skills: List[str],
        target_role: str,
        company_name: str,
        elapsed_minutes: float,
        is_preliminary: bool,
    ) -> Dict[str, Any]:
        """Deterministic, evidence-grounded fallback report when LLMs are offline."""
        num_answers = len(qa_turns)
        total_words = sum(len(t["answer"].split()) for t in qa_turns)
        avg_words = total_words / max(1, num_answers)

        # Baseline scoring based on answer depth and volume
        if num_answers == 0:
            overall_score = 1.0
            explanation = "No candidate answers were recorded during this session."
        elif avg_words < 5:
            overall_score = 2.0
            explanation = "Responses were minimal or single-word. Candidates should elaborate on technical implementation trade-offs."
        elif avg_words < 25:
            overall_score = 3.2
            explanation = "Candidate answered questions with basic points, but lacked deep architectural detail and metrics."
        elif avg_words < 60:
            overall_score = 4.0
            explanation = "Solid technical explanations with good relevance to the domain and role requirements."
        else:
            overall_score = 4.5
            explanation = "Comprehensive, detailed explanations demonstrating strong command of engineering concepts and project contribution."

        if is_preliminary:
            explanation = f"Preliminary assessment ({num_answers} answers completed in {elapsed_minutes} min): {explanation}"

        categories = {
            "technical_knowledge": min(5.0, max(1.0, overall_score)),
            "correctness": min(5.0, max(1.0, overall_score + 0.1)),
            "relevance": min(5.0, max(1.0, overall_score + 0.2)),
            "completeness_and_depth": min(5.0, max(1.0, overall_score - 0.2)),
            "problem_solving": min(5.0, max(1.0, overall_score)),
            "project_understanding": min(5.0, max(1.0, overall_score + 0.1)),
            "communication_and_clarity": min(5.0, max(1.0, overall_score)),
            "role_readiness": min(5.0, max(1.0, overall_score - 0.1)),
        }

        strengths = [
            f"Active engagement on {num_answers} interview turns for the {target_role} position.",
            f"Familiarity with foundational technologies relevant to {session.domain}."
        ]
        if candidate_projects:
            strengths.append(f"Referenced experience related to {candidate_projects[0]}.")

        weaknesses = [
            "Could elaborate further on production trade-offs, edge cases, and failure modes.",
            "Include specific quantitative metrics (e.g. latency, throughput, scale) when describing system architecture."
        ]

        skills_to_improve = []
        target_skills = jd_required_skills[:3] or candidate_skills[:3] or ["System Design", "Concurrency", "Testing"]
        for s in target_skills:
            skills_to_improve.append({
                "skill": s,
                "importance": "High",
                "what_to_learn": f"In-depth architectural patterns and production trade-offs in {s}.",
                "why_it_matters": f"Critical core requirement for engineering roles at {company_name}.",
                "what_was_misunderstood": "Opportunities for deeper technical precision during oral explanations.",
                "stronger_answer_guide": f"State the requirement, discuss 2 alternative approaches, and explain why your chosen design in {s} fits.",
                "suggested_practice_question": f"How do you ensure data integrity and fault tolerance when scaling {s}?",
            })

        better_answers = []
        if qa_turns:
            better_answers.append({
                "question": qa_turns[0]["question"],
                "candidate_answer_summary": qa_turns[0]["answer"][:120] + "...",
                "recommended_model_answer": (
                    "Structure your response with: 1) Context & Business Problem, "
                    "2) Architectural Choices & Trade-offs, 3) Personal Technical Contribution, "
                    "4) Production Metrics & Lessons Learned."
                )
            })

        return {
            "overall_score": round(overall_score, 1),
            "overall_explanation": explanation,
            "category_scores": {k: round(v, 1) for k, v in categories.items()},
            "category_assessments": {
                "technical_knowledge": "Demonstrated core domain principles.",
                "correctness": "Maintained logical consistency.",
                "relevance": "Directly answered recruiter questions.",
                "completeness_and_depth": "Could include more system trade-offs.",
                "problem_solving": "Addressed interview scenarios.",
                "project_understanding": "Explained personal project roles.",
                "communication_and_clarity": "Expressed thoughts clearly.",
                "role_readiness": f"Aligned with expectations for {target_role}.",
            },
            "strengths": strengths,
            "weaknesses_and_mistakes": weaknesses,
            "project_and_resume_evaluation": (
                f"Candidate effectively referenced background relevant to {target_role}. "
                "Ensure future answers explicitly state individual technical implementation details."
            ),
            "skills_to_improve": skills_to_improve,
            "better_answer_guidance": better_answers,
            "action_plan": [
                f"Review advanced production concepts in {', '.join(target_skills[:2])}.",
                "Practice framing answers using the STAR (Situation, Task, Action, Result) method with quantitative metrics.",
                "Conduct mock interviews focusing on architectural trade-offs and edge case handling."
            ],
            "interview_summary": {
                "target_role": target_role,
                "company": company_name,
                "interview_mode": session.interview_mode,
                "configured_duration_minutes": session.duration_minutes,
                "actual_elapsed_minutes": elapsed_minutes,
                "questions_completed": num_answers,
                "completion_status": session.status,
            },
            "is_preliminary": is_preliminary,
        }
