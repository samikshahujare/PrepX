from typing import Any, Dict, List, Optional
from app.adapters.question_generator.base import BaseQuestionGenerator


class MockQuestionGenerator(BaseQuestionGenerator):
    """High-quality deterministic question generator for local development and offline testing."""

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
        resume_skills = candidate_skills or ["Python", "SQL", "Git"]
        jd_skills = jd_required_skills or []
        target_role_str = target_role.strip() if target_role and target_role.strip() else f"{domain} Specialist"
        target_company = company.strip() if company and company.strip() else "our engineering organization"

        # 1. Compute skills intersection and JD gaps
        intersection = [s for s in resume_skills if any(s.lower() == j.lower() for j in jd_skills)]
        gaps = [j for j in jd_skills if not any(j.lower() == s.lower() for s in resume_skills)]

        primary_skill = intersection[0] if intersection else (resume_skills[0] if resume_skills else "System Design")
        secondary_skill = intersection[1] if len(intersection) > 1 else (jd_skills[0] if jd_skills else (resume_skills[1] if len(resume_skills) > 1 else "clean architecture"))
        project_ref = candidate_projects[0] if candidate_projects else None

        questions = []

        # Q1: Resume & Project Deep Dive (Personalized to candidate's actual projects and core skills)
        if project_ref and primary_skill:
            q1_text = (
                f"In your resume, you highlighted work on '{project_ref}' utilizing {primary_skill}. "
                f"For this {target_role_str} role, could you walk me through an architectural trade-off or technical bottleneck "
                f"you faced on that project and why you chose your specific technical approach?"
            )
        else:
            q1_text = (
                f"I noticed your hands-on background in {primary_skill}. "
                f"Can you discuss a complex, production-grade problem you solved using {primary_skill} that demonstrates your depth as a {target_role_str}?"
            )
        questions.append({
            "question_text": q1_text,
            "category": "Resume",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 1,
        })

        # Q2: Domain & Job Description Alignment (Intersection or key JD requirement)
        diff_prefix = {
            "Low": "fundamental principles and clean implementations of",
            "Medium": "architectural trade-offs, concurrency handling, and performance optimization in",
            "High": "distributed fault tolerance, resilience patterns, and extreme scale in",
        }.get(difficulty, "core principles of")

        if jd_responsibilities:
            resp_snippet = jd_responsibilities[0]
            q2_text = (
                f"The job requirements emphasize {resp_snippet}. "
                f"How would you apply your knowledge of {diff_prefix} {secondary_skill} to fulfill this responsibility effectively?"
            )
        else:
            q2_text = (
                f"In the context of {domain} engineering, explain the {diff_prefix} {secondary_skill}. "
                f"How would you architect a production solution around it?"
            )
        questions.append({
            "question_text": q2_text,
            "category": "Domain",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 2,
        })

        # Q3: Technical Problem Solving / System Design / Coding Philosophy
        tech_question = {
            "Low": f"How do you design comprehensive unit, integration, and contract tests to ensure zero regressions in a {domain} system?",
            "Medium": f"Suppose your service experiencing high traffic suffers from unexpected latency spikes, memory leaks, and thread starvation. What systematic debugging workflow would you execute as a {target_role_str}?",
            "High": f"Design a resilient, low-latency, event-driven data pipeline for {domain} capable of processing hundreds of thousands of events per second under unpredictable network partitions.",
        }.get(difficulty, f"How do you ensure resilience and observability in {domain} systems?")
        questions.append({
            "question_text": tech_question,
            "category": "Technical",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 3,
        })

        # Q4: Company or Role-Specific Focus (Dynamic based on Interview Mode)
        if interview_mode == "Company-Specific" and company:
            q4_text = (
                f"Why are you specifically interested in joining {target_company} as a {target_role_str}, "
                f"and how do your past engineering accomplishments in {domain} align with {target_company}'s scale, technology ecosystem, and culture?"
            )
            cat4 = "Company"
        else:
            q4_text = (
                f"As a {target_role_str}, how do you balance rapid feature delivery with long-term technical debt, code refactoring, and security best practices?"
            )
            cat4 = "Role"
        questions.append({
            "question_text": q4_text,
            "category": cat4,
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 4,
        })

        # Q5: Behavioral & Cross-Functional Collaboration
        questions.append({
            "question_text": (
                f"Tell me about a time when you and a peer or lead held opposing opinions on an important {domain} architectural decision. "
                f"How did you validate each perspective with metrics or prototypes to reach technical alignment?"
            ),
            "category": "Behavioral",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 5,
        })

        return questions[:count]
