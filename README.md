<div align="center">

# 🚀 PrepX
### **Next-Generation AI Interview & Multi-User Group Discussion Training Platform**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL_3D-black?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.style=for-the-badge?style=for-the-badge)](LICENSE)

<br/>

**Practice Smarter. Interview with Confidence.**  
PrepX pairs job seekers and students with an interactive, animated 3D AI Interviewer (**Sarah Jenkins**) and real-time collaborative **Group Discussion (GD) arenas** to simulate authentic high-stakes hiring rounds.

<p align="center">
  <a href="#-quick-links">Quick Links</a> •
  <a href="#-screenshots--ui-tour">Screenshots</a> •
  <a href="#-core-features">Key Features</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-environment-variables">Env Setup</a> •
  <a href="#-api-reference">API Docs</a> •
  <a href="#-cloud-deployment">Deployment</a>
</p>

---

</div>

## 🔗 Quick Links

- 🌐 **Live Web Application**: [https://your-prepx-app.vercel.app](https://your-prepx-app.vercel.app) *(Update with your production URL)*
- 📖 **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs) (or `https://api.your-backend-domain.com/docs`)
- 📄 **Master Architecture Spec**: [`docs/PREPX_MASTER_ARCHITECTURE.md`](docs/PREPX_MASTER_ARCHITECTURE.md)
- 🐛 **Issue Tracker**: [GitHub Issues](https://github.com/your-username/PrepX/issues)

---

## 📸 Screenshots & UI Tour

> *Tip: Place your exported screenshots inside [`docs/screenshots/`](docs/screenshots/) to automatically display them below.*

| 🌟 Modern Landing Page | 🤖 Live 3D AI Interview Room (Sarah) |
|:---:|:---:|
| ![Landing Page](docs/screenshots/landing-hero.png)<br><sub>*Hero section with instant CTAs and feature highlights*</sub> | ![Interview Room](docs/screenshots/interview-room.png)<br><sub>*Three.js 3D Sarah avatar with viseme lip-sync & webcam HUD*</sub> |

| 👥 Real-Time Group Discussion (GD) Arena | 📑 Smart Resume & JD Parsing Wizard |
|:---:|:---:|
| ![Group Discussion Room](docs/screenshots/gd-room.png)<br><sub>*Multiplayer GD arena with live AI moderator & timer*</sub> | ![Resume Parser Wizard](docs/screenshots/resume-parser.png)<br><sub>*Automated skill extraction & tailored agenda generation*</sub> |

| 📊 In-Depth Performance Analytics | 📱 WhatsApp Instant Session Sharing |
|:---:|:---:|
| ![Performance Analytics](docs/screenshots/performance-analytics.png)<br><sub>*Rubric-based scoring across clarity, technical depth, and structure*</sub> | ![WhatsApp Invitations](docs/screenshots/whatsapp-invite.png)<br><sub>*Meta WhatsApp Cloud API integration for 1-click GD invites*</sub> |

---

## ✨ Core Features

### 1. 🤖 Interactive 3D WebGL AI Interviewer ("Sarah Jenkins")
- **Lifelike Browser 3D Rendering**: Fully articulated 3D avatar powered by Three.js and custom GLB model (`sarah.glb`).
- **Phoneme & Viseme Lip-Sync**: Synchronizes mouth aperture and viseme morph targets with real-time neural audio timestamps.
- **Natural Human Behavior**: Micro-expressions, random eye saccades, procedural blinking, conversational nods, and candidate-attentive head tracking.
- **2D Canvas Fallback**: Automatic, graceful degradation to lightweight 2D avatar for systems lacking dedicated WebGL acceleration.
- **Candidate Presence HUD**: Real-time webcam preview, voice activity meter, and live transcript HUD.

### 2. 🔄 Resilient Multi-LLM Cascading Failover Engine
PrepX never halts an interview due to quota limits or downtime. It utilizes a resilient multi-tier LLM router:
$$\text{Google Gemini 2.5 Flash} \longrightarrow \text{NVIDIA NIM} \longrightarrow \text{Groq Cloud (Sub-second)} \longrightarrow \text{OpenRouter Free}$$
- Dynamic prompt engineering generates contextual, technical, and behavioral follow-up questions tailored to candidate answers.

### 3. 👥 AI-Moderated Real-Time Group Discussions (GD)
- **Multiplayer Collaboration**: Real-time room orchestration over persistent WebSockets.
- **Autonomous AI Moderator**: Announces discussion topics, enforces ground rules, balances speaking time, and intervenes dynamically when conversation stalls or goes off-topic.
- **Instant Invitations**: Generates shareable join codes (`/gd/join/PREPX-GD-XXXXX`) and 1-click **WhatsApp Cloud API** invitations.
- **Individualized Analytics**: Evaluates each participant individually across leadership, relevance, active listening, interruptions, and filler words.

### 4. 📄 Deep Resume & Job Description (JD) Parsing
- Extract structured credentials, tech stacks, and domain expertise from **PDF** (`.pdf`) and **Word** (`.docx`) documents.
- Automatically calculates JD-Resume match percentage and tailors interview difficulty and question banks accordingly.

### 5. 🎙️ Neural Speech & Low-Latency Transcription
- **Backend Neural TTS**: Microsoft Edge TTS (`edge-tts`) streaming crystal-clear `en-US-JennyNeural` voice at zero cloud API cost.
- **Frontend STT**: Native Web Speech API integration (`SpeechRecognition`) for instantaneous, zero-latency transcription with text input modal fallback.

### 6. 📊 Rubric-Based Scoring & Performance Feedback
- Comprehensive post-session evaluations analyzing **Technical Depth**, **Communication Clarity**, **STAR Structure Alignment**, and **Confidence**.
- Generates actionable constructive feedback, highlighting strong answers and specific suggestions for improvement.

### 7. 🛡️ Enterprise Security & Auth
- Argon2id / Bcrypt password hashing.
- Dual-token JWT security: Short-lived access tokens + revocable SHA-256 hashed refresh tokens persisted in PostgreSQL.
- Strict CORS policies with zero credentialed wildcard permissions.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Next.js 14 Client (App Router)"]
        UI["Tailwind CSS + Framer Motion UI"]
        Avatar["Three.js 3D WebGL Avatar (Sarah)"]
        STT["Web Speech API (Candidate Voice)"]
        HUD["Webcam Preview & Audio Level Monitor"]
    end

    subgraph Backend["FastAPI REST & WebSocket Server"]
        Router["API Routing & Dependency Injection"]
        AuthSvc["JWT Auth & Argon2 Security"]
        DocParser["Resume / JD Extraction (PyPDF & Docx)"]
        
        subgraph GDModule["Group Discussion Engine"]
            WSManager["WebSocket Room Manager"]
            AIMod["Autonomous AI Moderator"]
        end
        
        subgraph AIEngine["Cascading Multi-LLM Engine"]
            Gemini["1. Google Gemini (Primary)"]
            NIM["2. NVIDIA NIM (Fallback 1)"]
            Groq["3. Groq Cloud (Fallback 2)"]
            OpenRouter["4. OpenRouter (Fallback 3)"]
        end

        TTS["Edge-TTS Neural Voice Streamer"]
    end

    subgraph Data["Persistence & External Services"]
        Postgres[("PostgreSQL 16 DB\nSQLAlchemy 2.0 + Alembic")]
        WhatsApp["Meta WhatsApp Cloud API"]
    end

    Client <-->|REST API / JWT| Router
    Client <-->|WebSocket Stream| WSManager
    Router --> AuthSvc
    Router --> DocParser
    Router --> AIEngine
    Router --> TTS
    AIEngine --> Gemini
    Gemini -.->|Failover| NIM
    NIM -.->|Failover| Groq
    Groq -.->|Failover| OpenRouter
    WSManager --> AIMod
    AIMod --> AIEngine
    WSManager --> WhatsApp
    Backend <--> Postgres
```

---

## 💻 Tech Stack Matrix

| Category | Technology | Version / Spec | Purpose |
|:---|:---|:---|:---|
| **Frontend Framework** | [Next.js](https://nextjs.org/) | `14.2.24` (App Router) | Client application, SSR, and dynamic page routing |
| **Language (Frontend)** | [TypeScript](https://www.typescriptlang.org/) | `5.4+` | End-to-end type safety |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/) | `3.4` + Lucide React | Modern dark-mode aesthetic & responsive layout |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) | `11.0` | Fluid micro-interactions & HUD transitions |
| **3D Rendering** | [Three.js](https://threejs.org/) | `0.186` | Real-time GLB rendering, morph targets & visemes |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) | `0.110+` | Asynchronous, high-throughput REST API & WebSockets |
| **Server Engine** | [Uvicorn](https://www.uvicorn.org/) | Standard ASGI | ASGI production server |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | `15 / 16+` | Relational storage for users, resumes, transcripts |
| **ORM & Migrations** | [SQLAlchemy](https://www.sqlalchemy.org/) & [Alembic](https://alembic.sqlalchemy.org/) | `2.0+` & `1.13+` | Asynchronous database modeling & schema migrations |
| **Primary LLM** | [Google Gemini](https://ai.google.dev/) | `gemini-2.5-flash` | Real-time question generation & candidate evaluation |
| **Fallback LLMs** | [NVIDIA NIM](https://build.nvidia.com/) / [Groq](https://groq.com/) / [OpenRouter](https://openrouter.ai/) | LLaMA 3.2 / Qwen 2.5 | High-availability fallback tiers |
| **Voice Synthesis** | [Microsoft Edge TTS](https://github.com/rany2/edge-tts) | `7.2+` | Free neural TTS audio streaming (`en-US-JennyNeural`) |
| **Voice Recognition** | Web Speech API | Native Browser | In-browser speech-to-text candidate responses |
| **Document Parser** | PyPDF & python-docx | Python 3.10+ | Extraction of skills and work history from resumes |

---

## 📁 Directory Structure

```text
PrepX/
├── .env.example                     # Root environment configuration template
├── .gitignore                        # Global git exclusions
├── README.md                         # Project documentation & GitHub showcase
│
├── backend/
│   ├── .env.example                  # Backend environment template
│   ├── alembic.ini                   # Database migrations configuration
│   ├── pytest.ini                    # Pytest test suite configuration
│   ├── requirements.txt              # Backend dependencies
│   ├── alembic/                      # Database migration scripts (Versions 001–004)
│   └── app/
│       ├── main.py                   # FastAPI app entrypoint, CORS & error handlers
│       ├── api/                      # REST & WebSocket routing
│       │   ├── deps.py               # Dependency injection (DB session, current user)
│       │   └── v1/
│       │       ├── router.py         # Master API v1 router
│       │       └── endpoints/        # Auth, Users, Resumes, Interviews, Avatar, GD
│       ├── core/                     # App settings, security, logging, exceptions
│       ├── db/                       # SQLAlchemy engine & Base model
│       ├── models/                   # DB schemas (User, Resume, Interview, GD)
│       ├── repositories/             # Database access layer
│       ├── schemas/                  # Pydantic validation schemas
│       └── services/                 # LLM engine, parsers, Edge-TTS, GD room manager
│
├── docs/                             # Architecture specifications & implementation plans
│   ├── PREPX_MASTER_ARCHITECTURE.md  # Complete 800+ line master specification
│   └── screenshots/                  # Repository screenshots showcase
│       └── .gitkeep
│
└── frontend/
    ├── .env.example                  # Frontend environment template
    ├── package.json                  # Next.js dependencies and scripts
    ├── tsconfig.json                 # TypeScript compiler configuration
    ├── tailwind.config.ts            # Tailwind CSS configuration
    ├── next.config.mjs               # Next.js build configuration
    ├── public/
    │   └── avatars/                  # 3D Sarah avatar model (sarah.glb)
    └── src/
        ├── app/                      # Next.js App Router pages
        │   ├── layout.tsx            # Global app layout & providers
        │   ├── page.tsx              # Landing page
        │   ├── login/page.tsx        # User login
        │   ├── register/page.tsx     # User registration
        │   ├── dashboard/page.tsx    # User dashboard & past session analytics
        │   ├── interview/            # AI Interviewer setup & live room
        │   └── gd/                   # Group Discussion creation, join & arena
        ├── components/               # Reusable UI components (Navbar, HUD, Transcript)
        ├── lib/                      # Axios client, auth helpers, Three.js 3D avatar
        └── types/                    # Shared TypeScript interfaces
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Python 3.10+**
- **Node.js 18.x or 20.x** & **npm**
- **PostgreSQL 14+** (running on port `5432`)
- **Git**

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/PrepX.git
cd PrepX
```

---

### 2. Database Initialization

Create a PostgreSQL database named `prepx_db`:

```sql
-- In psql or pgAdmin:
CREATE DATABASE prepx_db;
```

---

### 3. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows (PowerShell / CMD):
venv\Scripts\activate
# On macOS / Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your environment file from example
copy .env.example .env      # Windows
# cp .env.example .env       # Linux / macOS

# Configure your database credentials and API keys in backend/.env:
# POSTGRES_PASSWORD=your_postgres_password
# GEMINI_API_KEY=your_gemini_api_key

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

Backend will be accessible at:
- 🚀 **Base API**: `http://localhost:8000/api/v1`
- 📚 **Swagger Docs**: `http://localhost:8000/docs`
- 🩺 **Health Check**: `http://localhost:8000/api/v1/health`

---

### 4. Frontend Setup

Open a new terminal window:

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Create local environment file from example
copy .env.example .env.local    # Windows
# cp .env.example .env.local     # Linux / macOS

# Start Next.js development server
npm run dev
```

Frontend will be accessible at:
- 💻 **Web App**: `http://localhost:3000`

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description | Example / Default |
|---|:---:|---|---|
| `APP_NAME` | No | API application title | `"PrepX Backend API"` |
| `APP_ENV` | No | Environment mode | `development` / `production` |
| `DEBUG` | No | Verbose exception logging | `True` |
| `API_V1_STR` | No | API prefix | `/api/v1` |
| `SECRET_KEY` | **Yes** | 256-bit JWT signing secret | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `POSTGRES_SERVER` | **Yes** | PostgreSQL host address | `localhost` |
| `POSTGRES_PORT` | **Yes** | PostgreSQL port | `5432` |
| `POSTGRES_USER` | **Yes** | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD`| **Yes** | PostgreSQL password | `your_db_password` |
| `POSTGRES_DB` | **Yes** | Database name | `prepx_db` |
| `DATABASE_URL` | No | Managed PostgreSQL URI (Supabase/Neon) | `postgresql://user:pass@host:5432/db` |
| `CORS_ORIGINS` | **Yes** | Allowed web origins (comma-separated) | `http://localhost:3000,http://127.0.0.1:3000` |
| `LLM_PROVIDER` | No | Primary LLM engine | `gemini` |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API Key | `AIzaSy...` |
| `GEMINI_MODEL` | No | Gemini Model ID | `gemini-2.5-flash` |
| `NVIDIA_API_KEY` | No | NVIDIA NIM API Key (Fallback 1) | `nvapi-...` |
| `GROQ_API_KEY` | No | Groq Cloud Key (Fallback 2) | `gsk_...` |
| `OPENROUTER_API_KEY`| No | OpenRouter Key (Fallback 3) | `sk-or-...` |
| `AVATAR_PROVIDER` | No | Avatar rendering mode | `local` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description | Default / Example |
|---|:---:|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes** | Backend REST API endpoint | `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_APP_URL` | No | Public frontend URL for shareable links | `http://localhost:3000` |
| `NEXT_PUBLIC_WS_URL` | No | Dedicated WebSocket URL (auto-derived if unset) | `ws://localhost:8000` |

---

## 📡 Key API Endpoints

<details>
<summary><b>Click to expand API Endpoints Reference</b></summary>

### 🔐 Authentication (`/api/v1/auth`)
- `POST /register`: Register a new user account with Argon2 password hashing.
- `POST /login`: Authenticate credentials, returning JWT access token & HTTP-only refresh token.
- `POST /refresh`: Issue new access token using valid refresh token.
- `POST /logout`: Revoke active session tokens.

### 📄 Resumes (`/api/v1/resumes`)
- `POST /upload`: Upload PDF/DOCX resume, trigger parsing, and store extracted skills.
- `GET /me`: Retrieve all resumes belonging to the authenticated user.
- `GET /{id}`: Retrieve parsed structured data for a specific resume.

### 🎯 Interview Sessions (`/api/v1/interview-sessions`)
- `POST /parse-jd-text`: Extract role, requirements, and tech stack from job description text.
- `POST /start`: Initialize an interview session with tailored question agenda.
- `POST /{id}/submit-response`: Submit candidate answer (audio/text) for evaluation and dynamic follow-up.
- `GET /{id}/state`: Fetch current interview runtime state, questions, and transcript.
- `POST /{id}/complete`: Conclude interview session and generate comprehensive rubric scoring.

### 👥 Group Discussion (`/api/v1/gd`)
- `POST /sessions`: Create a new GD session (topic, category, duration, capacity).
- `POST /join`: Join a GD session using session code.
- `POST /{id}/invite/whatsapp`: Send automated WhatsApp invitation via Meta Cloud API.
- `WS /ws/{sessionId}`: Real-time multi-user WebSocket room with automated AI moderator.
- `GET /{id}/evaluations`: Retrieve individual participant metrics and analytics report.

### 🤖 Avatar & Speech (`/api/v1/avatar`)
- `POST /tts`: Generate real-time neural audio and phoneme viseme timestamps via Edge-TTS.

</details>

---

## 🌐 Cloud Deployment Guide

### 1. Frontend on [Vercel](https://vercel.com/)
1. Import your GitHub repository to Vercel.
2. Select **`frontend`** as the **Root Directory**.
3. Framework Preset: **Next.js**.
4. Configure Environment Variables in Vercel Project Settings:
   - `NEXT_PUBLIC_API_URL`: `https://api.your-backend-domain.com/api/v1`
   - `NEXT_PUBLIC_APP_URL`: `https://your-frontend-domain.vercel.app`
5. Click **Deploy**.

### 2. Backend on [Render](https://render.com/) / [Railway](https://railway.app/)
> **Note**: Because the Group Discussion module uses persistent WebSockets, deploy the backend to a persistent container service (not serverless functions).

1. Create a new **Web Service** pointing to your repository.
2. Root Directory: `backend`
3. Environment: `Python 3.10+`
4. Build Command:
   ```bash
   pip install -r requirements.txt && alembic upgrade head
   ```
5. Start Command:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
6. Supply environment variables (`DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `GEMINI_API_KEY`, etc.).

### 3. PostgreSQL on [Supabase](https://supabase.com/) / [Neon](https://neon.tech/)
1. Create a managed PostgreSQL project.
2. Copy the connection string and set `DATABASE_URL` in your backend environment:
   ```env
   DATABASE_URL=postgresql://user:password@aws-0-region.pooler.supabase.com:6543/postgres
   ```

---

## 🧪 Running Tests

```bash
# Run backend test suite
cd backend
pytest -v
```

---

## 🔒 Security Best Practices

- **Never commit `.env` or `.env.local` files**: All sensitive credentials must remain in `.gitignore`.
- **CORS Restriction**: Explicit domains are strictly validated; wildcard CORS with credentialed headers is disallowed.
- **Client vs. Server Isolation**: Backend secrets (`GEMINI_API_KEY`, `SECRET_KEY`, database credentials) are never exposed to the client bundle. Only `NEXT_PUBLIC_` prefixed keys are accessible in the browser.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. **Fork** the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a **Pull Request**.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ for job seekers, students, and engineers worldwide.

**[⬆ Back to Top](#-prepx)**

</div>
