import json
import os
from typing import Any, Dict, List, Optional
from app.adapters.question_generator.base import BaseQuestionGenerator
from app.adapters.question_generator.mock_generator import MockQuestionGenerator


class GeminiQuestionGenerator(BaseQuestionGenerator):
    """Google Gemini AI Question Generator Provider with graceful mock fallback."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
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
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = f"""You are Sarah Jenkins, a Senior Technical Interviewer conducting a mock interview for a candidate.
Target Role: {target_role or 'Software Engineer'}
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
Generate exactly {count} personalized interview questions tailored to:
1. The intersection and gaps between the candidate's resume and the job description.
2. The candidate's real project experience with specific technologies.
3. The selected mode ({interview_mode}): if Company-Specific, focus on company scale, culture, and architecture; if Role-Specific, focus on role technical depth and architectural trade-offs.

Return ONLY valid JSON in this exact structure:
[
  {{
    "question_text": "...",
    "category": "Resume|Technical|Behavioral|Domain|Company|Role",
    "difficulty": "{difficulty}",
    "source": "gemini",
    "sequence_number": 1
  }}
]
"""
            response = model.generate_content(prompt)
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_text)
            if isinstance(data, list) and len(data) > 0:
                for idx, q in enumerate(data, start=1):
                    q["sequence_number"] = idx
                    q["source"] = "gemini"
                return data[:count]
        except Exception:
            pass

        return self.fallback.generate_questions(**fallback_kwargs)
