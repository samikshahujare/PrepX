import re
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


KNOWN_SKILLS_CATALOG = [
    # Programming Languages
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "C", "Go", "Rust", "Ruby", "PHP", "Kotlin", "Swift", "Scala", "R", "SQL",
    # Frameworks & Libraries
    "FastAPI", "Flask", "Django", "React", "Next.js", "Vue", "Angular", "Node.js", "Express", "Spring Boot", ".NET", "Flutter",
    # Data Science / AI / ML
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "scikit-learn", "Keras", "NLP", "Computer Vision", "Pandas", "NumPy", "OpenCV", "MediaPipe", "Whisper", "LLM", "Generative AI",
    # Databases & Caching
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra", "SQLite", "Firebase",
    # Cloud & DevOps
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD", "Git", "GitHub", "Linux", "Terraform", "Nginx",
    # Core CS & Architecture
    "Data Structures", "Algorithms", "System Design", "Microservices", "REST API", "GraphQL", "WebSockets", "OOP", "Agile"
]


class BaseResumeParser(ABC):
    @abstractmethod
    def parse(self, raw_text: str) -> Dict[str, Any]:
        """Parse raw resume text into structured candidate profile data."""
        pass


class BasicDeterministicResumeParser(BaseResumeParser):
    """Deterministic regex & dictionary-based resume parser without external LLM dependencies."""

    def parse(self, raw_text: str) -> Dict[str, Any]:
        if not raw_text or not raw_text.strip():
            return {
                "candidate_name": None,
                "email": None,
                "phone": None,
                "skills": [],
                "education": [],
                "experience": [],
                "projects": [],
                "certifications": [],
                "raw_extracted_data": {},
            }

        email = self._extract_email(raw_text)
        phone = self._extract_phone(raw_text)
        name = self._extract_name(raw_text, email)
        skills = self._extract_skills(raw_text)
        education = self._extract_section(raw_text, ["education", "academic background", "qualification", "qualifications"])
        projects = self._extract_section(raw_text, ["projects", "personal projects", "academic projects", "key projects"])
        experience = self._extract_section(raw_text, ["experience", "work experience", "employment", "internships", "professional experience"])
        certifications = self._extract_section(raw_text, ["certifications", "certificates", "courses", "achievements", "licenses"])

        return {
            "candidate_name": name,
            "email": email,
            "phone": phone,
            "skills": skills,
            "education": education,
            "experience": experience,
            "projects": projects,
            "certifications": certifications,
            "raw_extracted_data": {
                "total_skills_count": len(skills),
                "extracted_sections": {
                    "has_education": len(education) > 0,
                    "has_projects": len(projects) > 0,
                    "has_experience": len(experience) > 0,
                }
            }
        }

    def _extract_email(self, text: str) -> Optional[str]:
        match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
        return match.group(0).lower() if match else None

    def _extract_phone(self, text: str) -> Optional[str]:
        # Matches formats like +1-555-555-5555, (555) 555-5555, +91 9876543210, 9876543210
        match = re.search(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
        return match.group(0).strip() if match else None

    def _extract_name(self, text: str, email: Optional[str]) -> Optional[str]:
        # Usually the candidate name is in the first 3 lines of the resume
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for line in lines[:3]:
            # Ignore lines that are emails, phones, or URLs
            if "@" in line or "http" in line or "www" in line or any(char.isdigit() for char in line):
                continue
            # If line is between 2 and 4 words and mostly alphabetic, it's likely the name
            words = line.split()
            if 1 <= len(words) <= 4 and all(re.match(r"^[A-Za-z\.\'-]+$", w) for w in words):
                return line
        if email:
            # Fallback: extract username portion from email
            user_part = email.split("@")[0]
            clean_name = " ".join([part.capitalize() for part in re.split(r"[\._-]", user_part) if part.isalpha()])
            if clean_name:
                return clean_name
        return "Candidate"

    def _extract_skills(self, text: str) -> List[str]:
        found_skills = []
        text_lower = f" {text.lower()} "
        for skill in KNOWN_SKILLS_CATALOG:
            pattern = rf"(?:\b|\s){re.escape(skill.lower())}(?:\b|\s|[,\.;])"
            if re.search(pattern, text_lower):
                found_skills.append(skill)
        return list(dict.fromkeys(found_skills))  # Unique preserve order

    def _extract_section(self, text: str, header_keywords: List[str]) -> List[str]:
        """Extract lines belonging to specific resume section headers."""
        lines = text.splitlines()
        capturing = False
        section_items = []

        all_major_headers = [
            "education", "academic background", "qualification", "qualifications",
            "skills", "technical skills", "skills & tools", "technologies",
            "experience", "work experience", "employment", "internships", "professional experience",
            "projects", "personal projects", "academic projects", "key projects",
            "certifications", "certificates", "achievements", "awards", "courses",
            "summary", "profile", "about me", "objective", "interests", "languages"
        ]

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            cleaned_header = re.sub(r"[:\-_#\*]", "", line_str).strip().lower()

            # Check if this line starts our target section
            if any(cleaned_header == kw or cleaned_header.startswith(f"{kw} ") for kw in header_keywords):
                capturing = True
                continue

            # Check if we hit another section header
            if capturing and any(cleaned_header == h or cleaned_header.startswith(f"{h} ") for h in all_major_headers):
                capturing = False
                break

            if capturing:
                section_items.append(line_str)

        return section_items[:15]  # Cap items per section for cleaner response


class ResumeParserService:
    def __init__(self, parser: Optional[BaseResumeParser] = None):
        self.parser = parser or BasicDeterministicResumeParser()

    def parse_resume(self, raw_text: str) -> Dict[str, Any]:
        return self.parser.parse(raw_text)


class JobDescriptionParser:
    """Parses raw job description text into structured role, company, skills, and requirements."""

    COMMON_ROLES = [
        "Machine Learning Engineer", "AI Engineer", "Data Scientist", "Data Analyst",
        "Full Stack Engineer", "Full Stack Developer", "Backend Engineer", "Backend Developer",
        "Frontend Engineer", "Frontend Developer", "DevOps Engineer", "Cloud Engineer",
        "Cloud Architect", "System Architect", "Site Reliability Engineer", "Cybersecurity Engineer",
        "Software Engineer", "Software Developer", "QA Engineer", "Mobile App Developer",
    ]

    KNOWN_COMPANIES = [
        "Goldman Sachs", "Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix",
        "Uber", "Stripe", "Airbnb", "Salesforce", "Oracle", "IBM", "Intel", "Nvidia",
        "Cisco", "Adobe", "Spotify", "LinkedIn", "Twitter", "X", "Palantir", "Databricks",
        "Snowflake", "Morgan Stanley", "JPMorgan Chase", "Bloomberg", "PayPal"
    ]

    def parse(self, raw_text: str) -> Dict[str, Any]:
        if not raw_text or not raw_text.strip():
            return {
                "company": None,
                "target_role": None,
                "domain": "Software Engineering (Full Stack)",
                "required_skills": [],
                "preferred_skills": [],
                "responsibilities": [],
                "qualifications": [],
                "experience_requirements": None,
                "keywords": [],
                "raw_text": "",
            }

        text = raw_text.strip()
        company = self._extract_company(text)
        target_role = self._extract_role(text)
        responsibilities = self._extract_section(text, [
            "responsibilities", "what you will do", "what you'll do", "key responsibilities",
            "duties", "role responsibilities", "job description"
        ])
        qualifications = self._extract_section(text, [
            "qualifications", "requirements", "what we are looking for", "what we look for",
            "minimum qualifications", "basic qualifications", "who you are", "must have"
        ])
        preferred_section = self._extract_section(text, [
            "preferred qualifications", "nice to have", "bonus points", "bonus skills", "preferred"
        ])

        all_skills = self._extract_skills(text)
        preferred_skills = self._extract_skills("\n".join(preferred_section)) if preferred_section else []
        required_skills = [s for s in all_skills if s not in preferred_skills]
        if not required_skills and all_skills:
            required_skills = all_skills

        domain = self._infer_domain(target_role, all_skills, text)
        experience = self._extract_experience(text)
        keywords = self._extract_keywords(text, all_skills)

        return {
            "company": company,
            "target_role": target_role,
            "domain": domain,
            "required_skills": required_skills,
            "preferred_skills": preferred_skills,
            "responsibilities": responsibilities,
            "qualifications": qualifications,
            "experience_requirements": experience,
            "keywords": keywords,
            "raw_text": text,
        }

    def _extract_company(self, text: str) -> Optional[str]:
        # 1. Regex check for "Company: Name" or "At [Company]"
        patterns = [
            r"(?i)(?:company|organization|employer)\s*[:\-]\s*([A-Za-z0-9\s&]+?)(?:\n|\r|,|\.|$)",
            r"(?i)(?:about|join)\s+([A-Z][A-Za-z0-9\s&]{2,30}?)(?:\s+team|\s+is\s+looking|\s+careers|:|\.|\n)",
        ]
        for pat in patterns:
            match = re.search(pat, text)
            if match:
                candidate = match.group(1).strip()
                if len(candidate) > 1 and len(candidate.split()) <= 4:
                    return candidate

        # 2. Known company exact match
        for comp in self.KNOWN_COMPANIES:
            if re.search(rf"\b{re.escape(comp)}\b", text, re.IGNORECASE):
                return comp

        return None

    def _extract_role(self, text: str) -> Optional[str]:
        # 1. Explicit labels
        patterns = [
            r"(?i)(?:job\s*title|role|position|job\s*role)\s*[:\-]\s*([A-Za-z0-9\s\/\(\)]+?)(?:\n|\r|,|$)",
            r"(?i)(?:hiring\s+for|looking\s+for\s+a(?:n)?)\s+([A-Za-z0-9\s]{3,40}?)(?:\s+to\s+join|\s+with|\s+at|\n|\r|,|\.|$)",
        ]
        for pat in patterns:
            match = re.search(pat, text)
            if match:
                val = match.group(1).strip()
                if len(val) >= 3 and len(val.split()) <= 5:
                    return val

        # 2. Common role catalog check
        for role in self.COMMON_ROLES:
            if re.search(rf"\b{re.escape(role)}\b", text, re.IGNORECASE):
                return role

        # 3. Check first line if short title
        first_line = text.splitlines()[0].strip() if text.splitlines() else ""
        if first_line and len(first_line.split()) <= 5 and not any(char in first_line for char in ["@", "http", "{", "}"]):
            if any(term in first_line.lower() for term in ["engineer", "developer", "analyst", "scientist", "architect", "lead"]):
                return first_line

        return None

    def _infer_domain(self, role: Optional[str], skills: List[str], text: str) -> str:
        combined = f"{role or ''} {' '.join(skills)} {text}".lower()

        if any(term in combined for term in ["data science", "data scientist", "pandas", "numpy", "scikit-learn"]):
            return "Data Science"
        if any(term in combined for term in ["machine learning", "deep learning", "tensorflow", "pytorch", "nlp", "computer vision", "llm", "generative ai"]):
            return "Machine Learning / AI"
        if any(term in combined for term in ["data analyst", "power bi", "tableau", "data analytics", "business intelligence"]):
            return "Data Analytics"
        if any(term in combined for term in ["frontend", "react", "next.js", "vue", "angular", "css", "html", "ui/ux"]):
            return "Frontend Engineering (React/Next.js)"
        if any(term in combined for term in ["backend", "fastapi", "django", "spring boot", "golang", "microservices", "flask"]):
            return "Backend Engineering (Python/Java/Go)"
        if any(term in combined for term in ["devops", "cloud", "aws", "kubernetes", "docker", "terraform", "ci/cd", "sre"]):
            return "Cloud & DevOps Architecture"
        if any(term in combined for term in ["cybersecurity", "security", "penetration", "soc", "infosec"]):
            return "Cybersecurity Engineering"
        if any(term in combined for term in ["mobile", "flutter", "react native", "ios", "android", "swift", "kotlin"]):
            return "Mobile App Development"
        if any(term in combined for term in ["system design", "distributed systems", "kafka", "cassandra", "high throughput"]):
            return "System Design & Distributed Systems"

        return "Software Engineering (Full Stack)"

    def _extract_skills(self, text: str) -> List[str]:
        found = []
        text_lower = f" {text.lower()} "
        for skill in KNOWN_SKILLS_CATALOG:
            pattern = rf"(?:\b|\s){re.escape(skill.lower())}(?:\b|\s|[,\.;])"
            if re.search(pattern, text_lower):
                found.append(skill)
        return list(dict.fromkeys(found))

    def _extract_section(self, text: str, header_keywords: List[str]) -> List[str]:
        lines = text.splitlines()
        capturing = False
        items = []

        all_headers = [
            "responsibilities", "what you will do", "what you'll do", "key responsibilities", "duties",
            "qualifications", "requirements", "what we are looking for", "minimum qualifications",
            "basic qualifications", "preferred qualifications", "nice to have", "bonus points",
            "benefits", "perks", "about us", "about the company", "compensation"
        ]

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            cleaned = re.sub(r"[:\-_#\*]", "", line_str).strip().lower()
            if any(cleaned == kw or cleaned.startswith(f"{kw} ") or cleaned.startswith(f"{kw}:") for kw in header_keywords):
                capturing = True
                continue

            if capturing and any(cleaned == h or cleaned.startswith(f"{h} ") or cleaned.startswith(f"{h}:") for h in all_headers if h not in header_keywords):
                capturing = False
                break

            if capturing:
                # Strip bullet points
                cleaned_item = re.sub(r"^[\*\-\•\d+\.]\s*", "", line_str).strip()
                if cleaned_item and len(cleaned_item) > 4:
                    items.append(cleaned_item)

        return items[:10]

    def _extract_experience(self, text: str) -> Optional[str]:
        match = re.search(r"(?i)(\d+[\+]?\s*(?:to\s*\d+)?\s*(?:years|yrs)(?:\s+of)?\s+(?:experience|exp))", text)
        if match:
            return match.group(1).strip()
        if re.search(r"(?i)\b(?:entry\s*level|fresher|new\s*grad)\b", text):
            return "Entry Level / Fresher"
        if re.search(r"(?i)\b(?:senior|lead|principal|staff)\b", text):
            return "Senior / Lead Level"
        return None

    def _extract_keywords(self, text: str, skills: List[str]) -> List[str]:
        extra_terms = [
            "REST API", "Microservices", "CI/CD", "High Concurrency", "Scalability",
            "Unit Testing", "Code Review", "Agile", "Scrum", "Git", "Clean Architecture",
            "Database Optimization", "Low Latency", "Distributed Systems"
        ]
        text_lower = text.lower()
        matched = [term for term in extra_terms if term.lower() in text_lower]
        combined = list(dict.fromkeys(skills[:8] + matched))
        return combined[:12]

