# PrepX: Intelligent AI Interview Training Platform

PrepX is an end-to-end, AI-powered interview preparation and coaching platform. It pairs candidates with an interactive, animated AI interviewer (**Sarah**) capable of conducting realistic, dynamic mock interviews tailored to a candidate's resume, job description, and domain.

---

## 🌟 Key Features (Current Codebase)

- **Interactive AI Interviewer (Sarah)**:
  - **3D WebGL Avatar**: Real-time 3D avatar rendering powered by Three.js and custom GLB model (`sarah.glb`).
  - **Lip-Sync & Viseme Engine**: Synchronized mouth and facial blendshapes mapped from speech phonemes and audio timestamps.
  - **2D Canvas Fallback**: Lightweight 2D canvas avatar provider for devices without WebGL acceleration.
  - **Candidate Video Preview**: Client-side webcam monitor and audio level meter for simulated interview environments.
- **Dynamic Question & Follow-up Generation**:
  - Context-aware technical and behavioral interview questions tailored to target job descriptions, experience levels, and uploaded resumes.
  - Dynamic follow-up question engine adapting to candidate answers in real time.
- **Multi-LLM Failover Engine**:
  - Resilient cascading router prioritizing free/low-latency tiers: **Google Gemini** $\to$ **NVIDIA NIM** $\to$ **Groq Cloud** $\to$ **OpenRouter**.
  - Automatic fallback on rate limits or API outages.
- **Resume Parsing & Skill Extraction**:
  - Upload PDF (`.pdf`) and Word (`.docx`) documents.
  - Automated text extraction and structured parsing of skills, work history, and domains.
- **Speech Synthesis (TTS) & Recognition (STT)**:
  - Backend neural speech synthesis powered by Microsoft Edge TTS (`edge-tts`).
  - Client-side Web Speech API integration for real-time speech-to-text transcription and audio fallback.
- **Response Evaluation & Scoring**:
  - Automated rubric-based evaluation scoring candidate responses across clarity, relevance, technical depth, and structure.
- **Secure Authentication & Session Management**:
  - Argon2id / bcrypt password hashing.
  - JWT authentication with access tokens and revocable, SHA-256-hashed refresh tokens stored in PostgreSQL.

---

## 🏛️ System Architecture

PrepX follows a modern modular architecture separating a Next.js frontend from a FastAPI layered backend:

```
┌─────────────────────────────────────────────────────────────┐
│                       Next.js Frontend                      │
│   (App Router, React 18, Three.js 3D Avatar, Tailwind CSS)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API / JWT
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       FastAPI Backend                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ API Endpoints (Auth, Users, Resumes, Interviews)      │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Application Services (LLM Router, Parser, Storage)    │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Adapters (Gemini, NVIDIA NIM, Groq, OpenRouter)       │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Persistence Layer (SQLAlchemy 2.0 ORM + Alembic)      │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Port 5432
                               ▼
                ┌──────────────────────────────┐
                │     PostgreSQL Database      │
                └──────────────────────────────┘
```

---

## 💻 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI & Styling**: React 18, Tailwind CSS, Lucide React, Framer Motion
- **3D Graphics**: Three.js (WebGL GLTFLoader, SkinnedMesh, MorphTargets, Viseme Engine)
- **Speech**: Web Speech API (`SpeechRecognition`, `speechSynthesis`)

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Server**: Uvicorn (ASGI)
- **Database**: PostgreSQL 16+ via SQLAlchemy 2.0 & Alembic
- **Validation**: Pydantic v2 & Pydantic-Settings
- **Security**: Python-Jose (JWT), Passlib (Argon2, Bcrypt)
- **File Parsing**: PyPDF, Python-docx
- **Speech Engine**: Microsoft Edge TTS (`edge-tts`)
- **LLM Integrations**: Google Generative AI (`google-generativeai`), OpenAI SDK (`openai` for NIM/Groq/OpenRouter)

---

## 📁 Project Structure

```
PrepX/
├── .env.example                     # Root environment configuration template
├── .gitignore                        # Comprehensive root git ignore rules
├── README.md                         # Project documentation
│
├── backend/
│   ├── .env.example                  # Backend environment template
│   ├── alembic.ini                   # Alembic database migration configuration
│   ├── pytest.ini                    # Pytest configuration
│   ├── requirements.txt              # Python dependencies
│   ├── alembic/                      # Database schema migrations
│   │   ├── env.py
│   │   └── versions/                 # Migration version scripts
│   ├── app/
│   │   ├── main.py                   # FastAPI application entrypoint
│   │   ├── adapters/                 # External service & LLM adapters
│   │   │   ├── ai/                   # Gemini & OpenAI-compatible providers
│   │   │   ├── interview_engine/     # Interview runtime adapter
│   │   │   └── question_generator/   # Question generator adapter
│   │   ├── api/                      # API routing and dependencies
│   │   │   ├── deps.py               # Dependency injection (DB, auth)
│   │   │   └── v1/endpoints/         # Auth, users, resumes, interviews, avatar
│   │   ├── core/                     # Configuration, security, exceptions, logging
│   │   ├── db/                       # Database engine and base models
│   │   ├── models/                   # SQLAlchemy models (User, Resume, Session)
│   │   ├── repositories/             # Data access layer
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   └── services/                 # Business logic (LLM, Parser, Storage)
│   └── tests/                        # Backend test suite
│
├── docs/                             # Architecture specifications & implementation plans
│   ├── PREPX_MASTER_ARCHITECTURE.md
│   └── superpowers/plans/
│
└── frontend/
    ├── .env.example                  # Frontend environment template
    ├── package.json                  # Node.js dependencies and scripts
    ├── tsconfig.json                 # TypeScript compiler configuration
    ├── tailwind.config.ts            # Tailwind CSS configuration
    ├── next.config.mjs               # Next.js configuration
    ├── public/
    │   └── avatars/                  # Sarah 3D model (sarah.glb) and textures
    └── src/
        ├── app/                      # Next.js routes (login, register, dashboard, interview)
        ├── components/               # React components (Navbar, Video, HUD, Transcript)
        ├── lib/
        │   ├── api.ts                # Axios HTTP client
        │   ├── auth.ts               # Authentication token helpers
        │   ├── avatar/               # Three.js 3D Sarah engine & Viseme synchronizer
        │   └── speech/               # Speech-to-text & text-to-speech providers
        └── types/                    # Shared TypeScript interfaces
```

---

## ⚙️ Environment Variables

Copy the provided `.env.example` templates before starting the application:

### Backend Variables (`backend/.env`)

| Variable | Description | Default / Example |
|---|---|---|
| `APP_NAME` | Name of the backend application | `"PrepX Backend API"` |
| `APP_ENV` | Application environment (`development` / `production`) | `development` |
| `DEBUG` | Enable debug logs and detailed tracebacks | `True` |
| `API_V1_STR` | API version prefix | `/api/v1` |
| `SECRET_KEY` | 256-bit secret key for signing JWTs | Hex string (`python -c "import secrets; print(secrets.token_hex(32))"`) |
| `POSTGRES_SERVER` | PostgreSQL server hostname | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_USER` | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `your_postgres_password` |
| `POSTGRES_DB` | PostgreSQL database name | `prepx_db` |
| `CORS_ORIGINS` | Permitted CORS origins (comma-separated) | `http://localhost:3000,http://127.0.0.1:3000` |
| `LLM_PROVIDER` | Primary LLM provider | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API key | Active Gemini API key |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.5-flash` |
| `NVIDIA_API_KEY` | NVIDIA NIM API key (Fallback 1) | Active NVIDIA key |
| `NVIDIA_MODEL` | NVIDIA NIM model name | `meta/llama-3.2-11b-vision-instruct` |
| `GROQ_API_KEY` | Groq Cloud API key (Fallback 2) | Active Groq key |
| `GROQ_MODEL` | Groq model name | `qwen/qwen3.8-27b` |
| `OPENROUTER_API_KEY` | OpenRouter API key (Fallback 3) | Active OpenRouter key |
| `OPENROUTER_MODEL` | OpenRouter model name | `openrouter/free` |
| `AVATAR_PROVIDER` | AI Interviewer avatar provider | `local` |

### Frontend Variables (`frontend/.env.local`)

| Variable | Description | Default / Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | FastApi backend base endpoint | `http://localhost:8000/api/v1` |

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **PostgreSQL 14+** (running on port `5432`)

---

### 1. Database Setup

Create a PostgreSQL database named `prepx_db`:

```sql
CREATE DATABASE prepx_db;
```

---

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
# Edit .env with your PostgreSQL credentials and LLM API keys

# Apply database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

The backend API will be accessible at:
- **API Base**: `http://localhost:8000/api/v1`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/api/v1/health`

---

### 3. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Configure environment variables
copy .env.example .env.local

# Start Next.js development server
npm run dev
```

The frontend web app will be available at:
- `http://localhost:3000`

---

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
pytest
```

---

## 🌐 Cloud Deployment Architecture

PrepX is designed for modern decoupled cloud deployment:

### 1. Frontend (Vercel)
* **Framework:** Next.js (App Router)
* **Root Directory:** `frontend`
* **Build Command:** `npm run build`
* **Output Directory:** Next.js default (`.next`)
* **Environment Variables in Vercel:**
  * `NEXT_PUBLIC_API_URL`: `https://api.your-backend-domain.com/api/v1`
  * `NEXT_PUBLIC_APP_URL`: `https://your-frontend-domain.vercel.app`
  * `NEXT_PUBLIC_WS_URL`: `wss://api.your-backend-domain.com` *(optional; auto-derived from `NEXT_PUBLIC_API_URL`)*

### 2. Backend (Render / Railway / Fly.io / Docker / VPS)
* **Runtime:** Python 3.10+ (FastAPI + Uvicorn)
* **Host Requirement:** Must be a **persistent service** that supports persistent WebSockets (for live Group Discussion rooms and audio streaming). *Do not deploy backend WebSocket endpoints to serverless functions with execution timeouts.*
* **Production Start Command:**
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
* **Database Migrations:** Run on deploy:
  ```bash
  alembic upgrade head
  ```
* **Key Backend Environment Variables:**
  * `DATABASE_URL`: Managed PostgreSQL connection URI (`postgresql://...`). Automatically normalized if starting with `postgres://`.
  * `CORS_ORIGINS`: Your production frontend origin (`https://your-frontend-domain.vercel.app`).
  * `FRONTEND_URL`: Canonical frontend URL (`https://your-frontend-domain.vercel.app`) for generating invitations.
  * `SECRET_KEY`: High-entropy random hex key (`python -c "import secrets; print(secrets.token_hex(32))"`).
  * `LLM_PROVIDER`, `GEMINI_API_KEY`, `NVIDIA_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`: Server-side API credentials.

### 3. Managed PostgreSQL (Supabase / Neon / Render / Railway)
* Standard PostgreSQL 14+ instance.
* Supply the pooled or direct connection string in `DATABASE_URL`.

---

## 🔒 Security Best Practices

- **Never commit `.env` or `.env.local` files**: All secret keys, tokens, and database passwords must stay out of version control.
- **Client vs Server Secrets**: Database credentials, LLM keys, and JWT secrets are strictly backend-only. The frontend only receives `NEXT_PUBLIC_` URLs.
- **CORS Specification**: Explicit origins are required; wildcard `*` with credentials enabled is strictly forbidden and rejected.
- **Upload Directory**: Uploaded candidate resumes are stored locally in `uploads/` (or `backend/uploads/`) and are explicitly ignored by `.gitignore`.
- **JWT Key Rotation**: In production, ensure `SECRET_KEY` is generated via a cryptographically secure pseudo-random number generator (`secrets.token_hex(32)`).
