import httpx

BASE = "http://127.0.0.1:8000/api/v1"

# 1. Register/Login test user
email = "e2e_candidate@prepx.ai"
password = "TestPassword123!"
auth_res = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password})
if auth_res.status_code != 200:
    reg_res = httpx.post(f"{BASE}/auth/register", json={"email": email, "password": password, "full_name": "E2E Candidate"})
    assert reg_res.status_code == 201, reg_res.text
    auth_res = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password})

token = auth_res.json()["data"]["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Test JD Analysis endpoint
jd_sample = """Company: Goldman Sachs
Role: Machine Learning Engineer
Responsibilities:
- Deploy predictive pricing models with Python and XGBoost
- Scale real-time Kafka streams
Qualifications:
- 4+ years Python, SQL, and Docker experience"""
jd_res = httpx.post(f"{BASE}/interview-sessions/parse-jd-text", json={"text": jd_sample}, headers=headers)
assert jd_res.status_code == 200, jd_res.text
jd_data = jd_res.json()["data"]
print("JD Parsed:", jd_data["company"], "|", jd_data["target_role"], "|", jd_data["required_skills"])

# 3. Create Interview Session with full preparation
session_payload = {
    "domain": "Machine Learning / AI",
    "company": "Goldman Sachs",
    "target_role": "Machine Learning Engineer",
    "interview_mode": "Company-Specific",
    "difficulty": "High",
    "duration_minutes": 45,
    "allowed_attempts": 2,
    "job_description": jd_sample,
    "jd_analysis": jd_data,
}
sess_res = httpx.post(f"{BASE}/interview-sessions/sessions", json=session_payload, headers=headers)
assert sess_res.status_code == 201, sess_res.text
session = sess_res.json()["data"]
session_id = session["id"]
print(f"Session Created: {session_id} | Duration: {session['duration_minutes']} min | Mode: {session['interview_mode']}")

# 4. Generate Personalized Questions
gen_res = httpx.post(f"{BASE}/interview-sessions/sessions/{session_id}/questions/generate", json={"count": 5}, headers=headers)
assert gen_res.status_code == 200, gen_res.text
questions = gen_res.json()["data"]
print(f"Generated {len(questions)} Personalized Questions:")
for q in questions:
    print(f"  [{q['sequence_number']}] ({q['category']}) {q['question_text'][:85]}...")

# 5. Start Runtime with Sarah Jenkins
start_res = httpx.post(f"{BASE}/interview-sessions/sessions/{session_id}/start", headers=headers)
assert start_res.status_code == 200, start_res.text
start_data = start_res.json()["data"]
print("Runtime Started successfully! Status:", start_data["interview_status"])
print("Sarah Jenkins Initial Message:", start_data["interviewer_message"][:100], "...")
print("E2E PIPELINE COMPLETED SUCCESSFULLY WITHOUT ERROR!")
