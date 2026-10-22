from typing import Any, Dict, List, Optional
from app.adapters.question_generator.base import BaseQuestionGenerator


class MockQuestionGenerator(BaseQuestionGenerator):
    """High-quality deterministic question generator for local development and offline testing.
    
    Generates up to 10 deeply contextual questions following the 10-stage interview question plan:
    1. Resume Introduction
    2. Project Deep Dive
    3. Technical Fundamentals
    4. Role-Specific Technical Skills
    5. Problem Solving & Scenarios
    6. System Design / Architecture
    7. Resume/JD Cross-Question
    8. Production Bottlenecks & Trade-offs
    9. Behavioral & Collaboration
    10. Final Architectural Challenge
    """

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
        resume_skills = candidate_skills or ["Python", "SQL", "Git"]
        jd_skills = jd_required_skills or []
        target_role_str = target_role.strip() if target_role and target_role.strip() else f"{domain} Engineer"
        target_company = company.strip() if company and company.strip() else "our engineering organization"

        # Compute skills intersection and JD gaps
        intersection = [s for s in resume_skills if any(s.lower() == j.lower() for j in jd_skills)]
        primary_skill = intersection[0] if intersection else (resume_skills[0] if resume_skills else "System Architecture")
        secondary_skill = intersection[1] if len(intersection) > 1 else (jd_skills[0] if jd_skills else (resume_skills[1] if len(resume_skills) > 1 else "clean architecture"))
        project_ref = candidate_projects[0] if candidate_projects else None
        project_ref_2 = candidate_projects[1] if len(candidate_projects or []) > 1 else None

        questions = []

        # 1. Fixed Opening Question (Mandatory)
        questions.append({
            "question_text": "Tell me about yourself.",
            "category": "Opening",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 1,
        })

        # 2. Project Deep Dive (Cross-Questioning on candidate's real project)
        if project_ref:
            q2_text = f"Tell me about your work on the {project_ref} project."
        else:
            q2_text = f"Tell me about a key production system you built using {primary_skill}."
        questions.append({
            "question_text": q2_text,
            "category": "Resume",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 2,
        })

        # 3. Technical Fundamentals (Core principles for the domain)
        questions.append({
            "question_text": f"How do you ensure data consistency and prevent performance degradation under concurrent load in {primary_skill}?",
            "category": "Technical",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 3,
        })

        # 4. Role-Specific Technical Skills (Alignment with target role & secondary tech)
        questions.append({
            "question_text": f"How do you evaluate and integrate {secondary_skill} within a modern {domain} stack?",
            "category": "Technical",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 4,
        })

        # 5. Problem Solving & Practical Scenarios
        questions.append({
            "question_text": "How would you diagnose and isolate intermittent latency spikes in a production microservice?",
            "category": "Domain",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 5,
        })

        # 6. Practical System Architecture / Data Engineering
        questions.append({
            "question_text": f"How do you design a reliable caching strategy for high-throughput {domain} services?",
            "category": "Domain",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 6,
        })

        # 7. Resume / JD Cross-Question (Alignment with JD responsibilities)
        if jd_responsibilities:
            resp_snippet = jd_responsibilities[0].rstrip(".")
            q7_text = f"Connecting your background in {primary_skill} to the role, how would you approach {resp_snippet}?"
        elif project_ref_2:
            q7_text = f"What was your technical approach to validation and edge cases in {project_ref_2}?"
        else:
            q7_text = f"How do your past technical accomplishments in {primary_skill} prepare you for this role?"
        questions.append({
            "question_text": q7_text,
            "category": "Resume" if interview_mode != "Company-Specific" else "Company",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 7,
        })

        # 8. Production Trade-offs & Failure Handling
        questions.append({
            "question_text": "What is an architectural trade-off you made in a past project that you would design differently today?",
            "category": "Technical",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 8,
        })

        # 9. Behavioral & Engineering Culture
        if interview_mode == "Company-Specific" and company:
            q9_text = f"How do your engineering principles align with {target_company}'s engineering culture?"
            cat9 = "Company"
        else:
            q9_text = "Tell me about a time when you and a teammate had a technical disagreement on an architectural decision."
            cat9 = "Behavioral"
        questions.append({
            "question_text": q9_text,
            "category": cat9,
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 9,
        })

        # 10. Final Challenge & System Architecture
        questions.append({
            "question_text": f"If you had to re-architect your core service from scratch for 10x current scale, what would you prioritize first?",
            "category": "Domain",
            "difficulty": difficulty,
            "source": "mock",
            "sequence_number": 10,
        })

        # 11+. Expand dynamically for longer duration budgets (15, 30, 45, 60 minutes)
        if target_count > len(questions):
            extra_projects = candidate_projects[2:] if candidate_projects and len(candidate_projects) > 2 else []
            extra_skills = resume_skills[2:] if len(resume_skills) > 2 else []
            seq = len(questions) + 1

            # Cycle through additional candidate projects
            for ep in extra_projects:
                if len(questions) >= target_count:
                    break
                questions.append({
                    "question_text": f"Tell me about the architectural design and your personal contribution in the {ep} project.",
                    "category": "Resume",
                    "difficulty": difficulty,
                    "source": "mock",
                    "sequence_number": seq,
                })
                seq += 1

            # Cycle through additional technical skills
            for es in extra_skills:
                if len(questions) >= target_count:
                    break
                questions.append({
                    "question_text": f"In your hands-on work with {es}, what were the most significant trade-offs or performance bottlenecks you handled?",
                    "category": "Technical",
                    "difficulty": difficulty,
                    "source": "mock",
                    "sequence_number": seq,
                })
                seq += 1

            # Advanced engineering scenarios to fill remaining duration budget
            generic_scenarios = [
                f"How do you design and structure integration testing and CI/CD pipelines for {domain} microservices?",
                f"How would you approach automated observability, distributed tracing, and metrics instrumentation in {domain}?",
                "Tell me about a challenging production bug you investigated. How did you isolate the root cause?",
                f"How do you secure external APIs and manage sensitive credentials in a production {domain} environment?",
                "How do you balance rapid delivery of new features with technical debt and code refactoring?",
                f"If a downstream third-party dependency begins returning 500 errors or times out, how should your {domain} services gracefully degrade?",
            ]

            g_idx = 0
            while len(questions) < target_count:
                q_text = generic_scenarios[g_idx % len(generic_scenarios)]
                questions.append({
                    "question_text": q_text,
                    "category": "Technical" if g_idx % 2 == 0 else "Domain",
                    "difficulty": difficulty,
                    "source": "mock",
                    "sequence_number": seq,
                })
                seq += 1
                g_idx += 1

        return questions[:target_count]
