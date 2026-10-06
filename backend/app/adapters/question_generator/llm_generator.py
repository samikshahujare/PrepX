import json
import logging
from typing import Any, Dict, List, Optional
from app.adapters.question_generator.base import BaseQuestionGenerator
from app.adapters.question_generator.mock_generator import MockQuestionGenerator
from app.services.llm_service import llm_service

logger = logging.getLogger("prepx.question_generator")


class MultiLLMQuestionGenerator(BaseQuestionGenerator):
    """
    Question generator using the centralized free multi-LLM service
    (Gemini -> NVIDIA NIM -> Groq -> OpenRouter) with automatic failover
    and graceful mock fallback.
    """

    def __init__(self):
        self.fallback = MockQuestionGenerator()

    def generate_questions(
        self,
        domain: str,
        difficulty: str,
        company: Optional[str] = None,
        candidate_skills: Optional[List[str]] = None,
        candidate_projects: Optional[List[str]] = None,
        count: int = 10,
        target_role: Optional[str] = None,
        interview_mode: str = "Role-Specific",
        duration_minutes: int = 30,
        jd_required_skills: Optional[List[str]] = None,
        jd_responsibilities: Optional[List[str]] = None,
        job_description: Optional[str] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        target_count = count if (count and count > 0) else 10

        fallback_kwargs = {
            "domain": domain,
            "difficulty": difficulty,
            "company": company,
            "candidate_skills": candidate_skills,
            "candidate_projects": candidate_projects,
            "count": target_count,
            "target_role": target_role,
            "interview_mode": interview_mode,
            "duration_minutes": duration_minutes,
            "jd_required_skills": jd_required_skills,
            "jd_responsibilities": jd_responsibilities,
            "job_description": job_description,
        }

        system_prompt = (
            "You are Sarah Jenkins, a Senior Technical Interviewer conducting a mock interview for PrepX. "
            "Generate questions based on candidate profile and target job description. "
            "Output strictly valid JSON with no markdown wrapping."
        )

        user_prompt = f"""Target Role: {target_role or 'Software Engineer'}
Target Company: {company or 'Engineering Team'}
Target Domain: {domain}
Interview Mode: {interview_mode}
Difficulty Level: {difficulty}
Planned Duration: {duration_minutes} minutes
Candidate Resume Skills: {', '.join(candidate_skills) if candidate_skills else 'Not specified'}
Candidate Key Projects: {', '.join(candidate_projects[:3]) if candidate_projects else 'Not specified'}
Job Description Required Skills: {', '.join(jd_required_skills[:10]) if jd_required_skills else 'General requirements'}
Job Description Responsibilities: {', '.join(jd_responsibilities[:3]) if jd_responsibilities else 'General duties'}

Instruction:
Generate exactly {target_count} high-quality interview questions covering:
1. Technical depth and system architecture relevant to domain.
2. Experience-based questions probing the candidate's real projects and skills.
3. Problem solving & trade-offs based on the job description.

Return ONLY a JSON array in this exact schema:
[
  {{
    "question_text": "...",
    "category": "Resume|Domain|Technical|System Design|Behavioral",
    "difficulty": "{difficulty}",
    "sequence_number": 1
  }}
]
"""

        try:
            llm_res = llm_service.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                json_mode=True,
                temperature=0.7,
                max_tokens=2500,
            )

            if llm_res.success and llm_res.content:
                clean_text = llm_res.content.replace("```json", "").replace("```", "").strip()
                data = json.loads(clean_text)
                if isinstance(data, list) and len(data) > 0:
                    for idx, q in enumerate(data, start=1):
                        q["sequence_number"] = idx
                        q["source"] = f"llm_{llm_res.provider}"
                    logger.info(f"Generated {len(data)} questions via {llm_res.provider} ({llm_res.model})")
                    return data[:target_count]
        except Exception as e:
            logger.warning(f"MultiLLM question generation error: {e}, falling back to mock")

        return self.fallback.generate_questions(**fallback_kwargs)
