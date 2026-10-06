from app.core.security import create_access_token
from app.db.session import engine
from sqlalchemy import text
import urllib.request
import json

with engine.connect() as conn:
    user = conn.execute(text("SELECT id, email FROM users WHERE email = :email"), {"email": "ti.task.project@gmail.com"}).fetchone()
    if not user:
        print("User not found")
        exit(1)
    token = create_access_token(user[0])
    print("USER_ID:", user[0])

for ep in ['/users/me', '/resumes', '/interview-sessions/sessions']:
    req = urllib.request.Request('http://127.0.0.1:8000/api/v1' + ep, headers={'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print('ENDPOINT:', ep, 'STATUS:', resp.status, 'COUNT:', len(data.get('data', [])) if isinstance(data.get('data'), list) else 'OBJ')
    except urllib.error.HTTPError as e:
        print('ENDPOINT:', ep, 'FAIL:', e.code, e.read().decode())
