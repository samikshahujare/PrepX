import json
import os
from typing import Any, Dict, List, Optional
from app.adapters.question_generator.base import BaseQuestionGenerator
from app.adapters.question_generator.mock_generator import MockQuestionGenerator


class OpenAIQuestionGenerator(BaseQuestionGenerator):
    """OpenAI GPT Question Generator Provider with graceful mock fallback."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.fallback = MockQuestionGenerator()

    def generate_questions(
        self,
        domain: str,
        difficulty: str,
        company: Optional[str] = None,
        candidate_skills: Optional[List[str]] = None,
        candidate_projects: Optional[List[str]] = None,
        count: int = 5,
        target_role: Optional[str] = None,
        interview_mode: str = "Role-Specific",
        duration_minutes: int = 30,
        jd_required_skills: Optional[List[str]] = None,
        jd_responsibilities: Optional[List[str]] = None,
        job_description: Optional[str] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        fallback_kwargs = {
            "domain": domain,
            "difficulty": difficulty,
            "company": company,
            "candidate_skills": candidate_skills,
            "candidate_projects": candidate_projects,
            "count": count,
            "target_role": target_role,
            "interview_mode": interview_mode,
            "duration_minutes": duration_minutes,
            "jd_required_skills": jd_required_skills,
            "jd_responsibilities": jd_responsibilities,
            "job_description": job_description,
        }

        if not self.api_key:
            return self.fallback.generate_questions(**fallback_kwargs)

        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)

            prompt = f"""You are Sarah Jenkins, a Lead Technical Interviewer conducting a mock interview.
Target Domain: {domain}
Target Role: {target_role or 'Software Engineer'}
Interview Mode: {interview_mode}
Difficulty: {difficulty}
Company: {company or 'Engineering Team'}
Candidate Skills: {', '.join(candidate_skills) if candidate_skills else 'Standard skills'}
Candidate Projects: {', '.join(candidate_projects[:3]) if candidate_projects else 'General projects'}
JD Required Skills: {', '.join(jd_required_skills[:10]) if jd_required_skills else 'General requirements'}

Generate exactly {count} interview questions in JSON array format:
[
  {{
    "question_text": "...",
    "category": "Resume|Technical|Behavioral|Domain|Company|Role",
    "difficulty": "{difficulty}",
    "source": "openai",
    "sequence_number": 1
  }}
]
"""
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            raw = completion.choices[0].message.content or "{}"
            parsed = json.loads(raw)
            questions = parsed.get("questions", parsed) if isinstance(parsed, dict) else parsed
            if isinstance(questions, list) and len(questions) > 0:
                for idx, q in enumerate(questions, start=1):
                    q["sequence_number"] = idx
                    q["source"] = "openai"
                return questions[:count]
        except Exception:
            pass

        return self.fallback.generate_questions(**fallback_kwargs)
