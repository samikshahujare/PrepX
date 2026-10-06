from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseQuestionGenerator(ABC):
    """Abstract interface for AI & Mock Interview Question Generators."""

    @abstractmethod
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
        """Generate structured interview questions tailored to candidate and role criteria."""
        pass
