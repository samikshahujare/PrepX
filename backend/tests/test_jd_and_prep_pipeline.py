import pytest
from app.services.parser_service import JobDescriptionParser


def test_job_description_parser_structured_extraction():
    sample_jd = """
    Company: Goldman Sachs
    Role: Senior Machine Learning Engineer
    
    About Us:
    Join our quantitative engineering team building low latency prediction pipelines.

    Responsibilities:
    - Architect and scale real-time feature stores and predictive models
    - Optimize high concurrency training and inference pipelines
    - Partner with quantitative researchers to deploy XGBoost and deep learning models

    Qualifications:
    - 5+ years of experience in Python, SQL, and distributed systems
    - Strong background in Machine Learning, PyTorch, and Docker
    - Bachelor's or Master's degree in Computer Science or related field

    Preferred Qualifications:
    - Experience with Kubernetes and FastAPI in production
    - Familiarity with financial markets
    """

    parser = JobDescriptionParser()
    result = parser.parse(sample_jd)

    assert result["company"] == "Goldman Sachs"
    assert "Machine Learning Engineer" in result["target_role"]
    assert result["domain"] in ["Machine Learning / AI", "Data Science"]
    assert "Python" in result["required_skills"]
    assert "SQL" in result["required_skills"]
    assert "PyTorch" in result["required_skills"]
    assert len(result["responsibilities"]) >= 2
    assert len(result["qualifications"]) >= 2
    assert "5+ years" in (result["experience_requirements"] or "")


def test_parse_jd_endpoint(client, auth_headers):
    headers = {"Authorization": auth_headers["Authorization"]}

    jd_payload = {
        "text": """
        Company: Microsoft
        Role: Frontend Engineer
        Responsibilities:
        - Develop responsive web applications using Next.js and React
        - Collaborate with UI/UX designers to implement modern interfaces
        Qualifications:
        - 3+ years experience with TypeScript, React, and CSS
        """
    }

    response = client.post("/api/v1/interview-sessions/parse-jd-text", json=jd_payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["company"] == "Microsoft"
    assert "Frontend" in data["data"]["target_role"]
    assert "React" in data["data"]["required_skills"]


def test_create_session_with_full_preparation_and_generate_questions(client, auth_headers):
    headers = {"Authorization": auth_headers["Authorization"]}

    # 1. Create session with full preparation configuration
    session_payload = {
        "domain": "Machine Learning / AI",
        "company": "Goldman Sachs",
        "target_role": "Machine Learning Engineer",
        "interview_mode": "Company-Specific",
        "difficulty": "High",
        "duration_minutes": 45,
        "allowed_attempts": 2,
        "job_description": "We are seeking a Machine Learning Engineer with Python and XGBoost expertise.",
        "jd_analysis": {
            "company": "Goldman Sachs",
            "target_role": "Machine Learning Engineer",
            "required_skills": ["Python", "XGBoost", "SQL"],
            "responsibilities": ["Deploy machine learning models into low-latency trading pipelines"],
        }
    }

    create_res = client.post("/api/v1/interview-sessions/sessions", json=session_payload, headers=headers)
    assert create_res.status_code == 201
    created_session = create_res.json()["data"]

    session_id = created_session["id"]
    assert created_session["company"] == "Goldman Sachs"
    assert created_session["target_role"] == "Machine Learning Engineer"
    assert created_session["interview_mode"] == "Company-Specific"
    assert created_session["duration_minutes"] == 45
    assert created_session["allowed_attempts"] == 2
    assert created_session["current_attempt"] == 1

    # 2. Generate personalized questions
    gen_res = client.post(f"/api/v1/interview-sessions/sessions/{session_id}/questions/generate", json={"count": 5}, headers=headers)
    assert gen_res.status_code == 200
    questions = gen_res.json()["data"]
    assert len(questions) == 5

    # Check question personalization
    question_texts = " ".join([q["question_text"] for q in questions])
    assert any("Goldman Sachs" in q["question_text"] or q["category"] in ["Company", "Resume", "Technical", "Domain"] for q in questions)

    # 3. Retrieve session and confirm all fields are preserved
    get_res = client.get(f"/api/v1/interview-sessions/sessions/{session_id}", headers=headers)
    assert get_res.status_code == 200
    retrieved = get_res.json()["data"]
    assert retrieved["duration_minutes"] == 45
    assert retrieved["target_role"] == "Machine Learning Engineer"
    assert retrieved["interview_mode"] == "Company-Specific"
    assert retrieved["allowed_attempts"] == 2
    assert len(retrieved["questions"]) == 5
