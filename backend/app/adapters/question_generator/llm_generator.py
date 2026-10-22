import json
import logging
from typing import Any, Dict, List, Optional
from app.adapters.question_generator.base import BaseQuestionGenerator
from app.adapters.question_generator.mock_generator import MockQuestionGenerator
from app.services.llm_service import llm_service

logger = logging.getLogger("prepx.question_generator")


def normalize_category(cat: str, default: str = "Technical") -> str:
    cat_lower = (cat or "").lower()
    if "opening" in cat_lower or "intro" in cat_lower:
        return "Opening"
    if "company" in cat_lower or "culture" in cat_lower:
        return "Company"
    if "resume" in cat_lower or "project" in cat_lower:
        return "Resume"
    if "behavior" in cat_lower or "collaborat" in cat_lower:
        return "Behavioral"
    if "domain" in cat_lower or "system" in cat_lower or "architecture" in cat_lower or "problem" in cat_lower:
        return "Domain"
    if "tech" in cat_lower or "fundament" in cat_lower or "code" in cat_lower or "role" in cat_lower or "trade" in cat_lower:
        return "Technical"
    return default


class MultiLLMQuestionGenerator(BaseQuestionGenerator):
    """
    Question generator using the centralized free multi-LLM service
    (Gemini -> NVIDIA NIM -> Groq -> OpenRouter) with automatic failover,
    10-category question planning, resume project cross-questioning,
    and anti-hallucination safeguards.
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
            **kwargs,
        }

        system_prompt = (
            "You are Sarah Jenkins, a Senior Technical Recruiter and Engineering Interviewer at PrepX. "
            "You generate structured, deeply relevant mock interview questions following a rigorous 10-stage plan. "
            "Anti-Hallucination: Use only actual skills and projects present in the candidate profile or requirements in the JD. "
            "Do NOT invent unlisted companies, degrees, tools, or projects. "
            "Output strictly valid JSON with no markdown wrapping."
        )

        projects_str = ", ".join(candidate_projects[:4]) if candidate_projects else "None specified"
        skills_str = ", ".join(candidate_skills[:12]) if candidate_skills else "General CS background"
        jd_skills_str = ", ".join(jd_required_skills[:10]) if jd_required_skills else "General role requirements"
        jd_resp_str = "; ".join(jd_responsibilities[:3]) if jd_responsibilities else "Core role duties"

        user_prompt = f"""Target Role: {target_role or 'Software Engineer'}
Target Company: {company or 'Engineering Team'}
Domain: {domain}
Interview Mode: {interview_mode}
Difficulty: {difficulty}
Planned Duration: {duration_minutes} minutes

Candidate Resume Skills: {skills_str}
Candidate Resume Projects: {projects_str}
Job Description Required Skills: {jd_skills_str}
Job Description Responsibilities: {jd_resp_str}

Instructions:
Generate exactly {target_count} high-caliber interview questions following this plan:
1. Opening: Must be strictly: "Tell me about yourself." (Category: "Opening")
2. Project Deep Dive: One concise question about a candidate project ({projects_str}). (Category: "Resume")
3. Technical Fundamentals: One concise question on core principles for {domain} at {difficulty} difficulty. (Category: "Technical")
4. Role-Specific Technical Skills: One concise question on practical engineering in the domain. (Category: "Technical")
5. Problem Solving: One concise troubleshooting scenario. (Category: "Domain")
6. System Design: One concise architecture or data strategy question. (Category: "Domain")
7. Resume / JD Cross-Question: One concise question connecting resume skills to role responsibilities. (Category: "Resume" or "Company")
8. Trade-offs: One concise question on a real-world technical decision trade-off. (Category: "Technical")
9. Behavioral & Collaboration: One concise question on team engineering dynamics. (Category: "Behavioral" or "Company")
10. Final Challenge: One concise forward-looking system challenge. (Category: "Domain")

Core Rules:
- Rule 1 (MANDATORY): Question 1 MUST be strictly "Tell me about yourself." with category "Opening".
- Rule 2 (MANDATORY): ONE CONCISE QUESTION PER TURN. Each question must be 1-2 sentences maximum. NEVER combine multiple questions into a single turn or paragraph.
- Categories MUST strictly be one of: "Opening", "Resume", "Technical", "Company", "Domain", "Behavioral".
- If Target Company is provided and Interview Mode is Company-Specific, include at least one question relevant to {company} with category "Company".
- Anti-Hallucination: Only reference projects and skills explicitly listed above. Never invent unlisted companies or experiences.
- Adapt to {difficulty} difficulty naturally.

Return ONLY a JSON array in this exact schema:
[
  {{
    "question_text": "Tell me about yourself.",
    "category": "Opening",
    "difficulty": "{difficulty}",
    "sequence_number": 1
  }},
  {{
    "question_text": "Tell me about your work on the placement analytics dashboard project.",
    "category": "Resume",
    "difficulty": "{difficulty}",
    "sequence_number": 2
  }}
]
"""

        try:
            llm_res = llm_service.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                json_mode=True,
                temperature=0.6,
                max_tokens=3000,
            )

            if llm_res.success and llm_res.content:
                clean_text = llm_res.content.replace("```json", "").replace("```", "").strip()
                data = json.loads(clean_text)
                if isinstance(data, list) and len(data) > 0:
                    # Enforce fixed opening question
                    data[0]["question_text"] = "Tell me about yourself."
                    data[0]["category"] = "Opening"
                    for idx, q in enumerate(data, start=1):
                        q["sequence_number"] = idx
                        q["source"] = f"llm_{llm_res.provider}"
                        if idx == 1:
                            q["category"] = "Opening"
                        else:
                            q["category"] = normalize_category(q.get("category", ""), default="Technical")
                    logger.info(f"Generated {len(data)} questions via {llm_res.provider} ({llm_res.model})")
                    return data[:target_count]
        except Exception as e:
            logger.warning(f"MultiLLM question generation error: {e}, falling back to mock")

        return self.fallback.generate_questions(**fallback_kwargs)
