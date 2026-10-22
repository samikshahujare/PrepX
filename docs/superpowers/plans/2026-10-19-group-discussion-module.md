# Group Discussion (GD) Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate a complete multiplayer Group Discussion (GD) module into PrepX with real-time audio streaming, shared live transcription, Sarah Jenkins 3D AI Moderator, and individualized 12-rubric evaluations, alongside the existing Personal Interview flow without breaking any existing features.

**Architecture:** A FastAPI modular monolith backend exposes REST and WebSocket endpoints (`/api/v1/gd`) with PostgreSQL persistence via SQLAlchemy/Alembic. The frontend uses Next.js 14 with a dual-track dashboard, Web Audio API binary audio relay, client-side STT with authenticated participant tagging, and the existing Three.js Sarah Jenkins `AvatarStage` as the AI moderator.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Lucide icons, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Web Audio API, Web Speech API, Google Gemini (with NVIDIA NIM / Groq failover).

**Spec:** [docs/superpowers/specs/2026-10-19-group-discussion-module-design.md](file:///c:/Users/Admin/OneDrive/Desktop/PrepX/docs/superpowers/specs/2026-10-19-group-discussion-module-design.md)

## Global Constraints
- Preserve all existing personal interview features: resume upload, JD extraction, question generation, LLM failover, personal room `/interview/[sessionId]`, and feedback modals.
- Zero modifications to Sarah's 3D avatar GLB file (`frontend/public/avatars/sarah.glb`), face, hair, clothing, body, or animations.
- Use existing database and Alembic migration sequences without colliding with active migrations.
- Do not introduce paid third-party real-time audio services or external server daemons.
- Every participant must receive an individualized, evidence-grounded evaluation report (no identical group scores).

## Review Focus
- **Reconnection without state corruption**: A participant refreshing or reconnecting to a live GD session must not increment participant counts or orphan their session state.
- **Audio feedback / echo prevention**: A participant's outgoing audio chunks relayed to peers must never be fed back into their own audio output.
- **Moderator turn collision**: Sarah must not speak over participants continuously; interventions must respect rate limits and a 60–90 second cooldown.
- **Private evaluation isolation**: One participant changing a URL must never be able to inspect another participant's private evaluation scorecard.
- **Personal interview regression**: Existing personal interview tests and candidate workspace functions must remain 100% operational.

---

### Task 1: Database Models & Alembic Migration for Group Discussion

**Files:**
- Create: `backend/app/models/gd.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/006_group_discussion_module.py`
- Test: `backend/tests/test_gd_models.py`

**Interfaces:**
- Produces: `GDSession`, `GDParticipant`, `GDInvitationToken`, `GDTranscript`, `GDEvaluation` models in SQLAlchemy `Base`.

- [ ] **Step 1: Write the failing test for GD models**
Create `backend/tests/test_gd_models.py` asserting that `GDSession`, `GDParticipant`, `GDInvitationToken`, `GDTranscript`, and `GDEvaluation` can be instantiated, queried, and properly relate to `User`.
- [ ] **Step 2: Run test to verify it fails**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.gd'`.
- [ ] **Step 3: Implement `backend/app/models/gd.py` and register in `backend/app/models/__init__.py`**
Implement the five SQLAlchemy models with UUID primary keys, JSONB support, relationships, and cascade rules.
- [ ] **Step 4: Create and apply Alembic migration `006_group_discussion_module.py`**
Generate the migration upgrading `005_duration_deadline_feedback` to create `gd_sessions`, `gd_participants`, `gd_invitation_tokens`, `gd_transcripts`, and `gd_evaluations` tables with indexes. Apply with `alembic upgrade head`.
- [ ] **Step 5: Run test to verify it passes**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_models.py -v`
Expected: PASS.
- [ ] **Step 6: Commit checkpoint**
`git add backend/app/models/gd.py backend/app/models/__init__.py backend/alembic/versions/006_group_discussion_module.py backend/tests/test_gd_models.py && git commit -m "feat(gd): add database models and alembic migration for group discussion"`

---

### Task 2: GD Backend Service & Topic Generator with Multi-LLM Failover

**Files:**
- Create: `backend/app/services/gd_service.py`
- Create: `backend/app/schemas/gd.py`
- Test: `backend/tests/test_gd_service.py`

**Interfaces:**
- Consumes: `LLMProviderManager` (`backend/app/services/llm_service.py`)
- Produces: `gd_service.create_session`, `gd_service.generate_topic`, `gd_service.get_session`, `gd_service.create_invitation_token`, `gd_service.validate_invitation`.

- [ ] **Step 1: Write the failing test for GD service**
Test topic generation across categories (*Technology & AI*, *Business*, *Social & Ethical*, etc.), session creation with unique `PREPX-GD-XXXXX` codes, and invitation token generation.
- [ ] **Step 2: Run test to verify it fails**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_service.py -v`
Expected: FAIL with missing `gd_service`.
- [ ] **Step 3: Implement `backend/app/schemas/gd.py` and `backend/app/services/gd_service.py`**
Define Pydantic schemas for request/response validation. Implement `GDService` methods with fallbacks for topic generation when offline.
- [ ] **Step 4: Run test to verify it passes**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_service.py -v`
Expected: PASS.
- [ ] **Step 5: Commit checkpoint**
`git add backend/app/schemas/gd.py backend/app/services/gd_service.py backend/tests/test_gd_service.py && git commit -m "feat(gd): implement gd service and ai topic generator"`

---

### Task 3: REST API Endpoints & Invitation Sharing Handlers

**Files:**
- Create: `backend/app/api/v1/endpoints/gd.py`
- Modify: `backend/app/api/v1/router.py`
- Test: `backend/tests/test_gd_api.py`

**Interfaces:**
- Produces:
  - `POST /api/v1/gd/sessions` (Create session)
  - `GET /api/v1/gd/sessions` (List user sessions)
  - `GET /api/v1/gd/sessions/{session_id}` (Get details)
  - `POST /api/v1/gd/sessions/{session_id}/generate-topic` (Generate topic)
  - `POST /api/v1/gd/sessions/{session_id}/invitations` (Create invite token & share links)
  - `GET /api/v1/gd/invitations/{token}/validate` (Public link validation)
  - `POST /api/v1/gd/invitations/{token}/join` (Join session with display name / guest id)

- [ ] **Step 1: Write the failing test for GD API endpoints**
Test authenticated session creation, public invitation link validation, WhatsApp message generator, and participant joining.
- [ ] **Step 2: Run test to verify it fails**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_api.py -v`
Expected: FAIL with 404 on `/api/v1/gd`.
- [ ] **Step 3: Implement `backend/app/api/v1/endpoints/gd.py` and mount in `router.py`**
Add the REST endpoints, enforce JWT authentication on creator actions, provide public token validation for invited peers, and format prefilled WhatsApp (`https://api.whatsapp.com/send?text=...`) and Email share links.
- [ ] **Step 4: Run test to verify it passes**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_api.py -v`
Expected: PASS.
- [ ] **Step 5: Commit checkpoint**
`git add backend/app/api/v1/endpoints/gd.py backend/app/api/v1/router.py backend/tests/test_gd_api.py && git commit -m "feat(gd): add gd rest api endpoints and invitation handlers"`

---

### Task 4: Real-Time WebSocket Gateway, Audio Relay & Presence Manager

**Files:**
- Create: `backend/app/services/gd_room_manager.py`
- Modify: `backend/app/api/v1/endpoints/gd.py` (Add WebSocket endpoint `/api/v1/gd/ws/{session_code}`)
- Test: `backend/tests/test_gd_websocket.py`

**Interfaces:**
- Produces: `GDRoomManager` managing connected participant WebSockets, broadcasting audio chunks, syncing presence, updating mute states, and dispatching room status.

- [ ] **Step 1: Write the failing test for GD WebSocket gateway**
Test connecting two mock WebSocket clients to the same `session_code`, verifying `PARTICIPANT_JOINED`, audio packet relay from client 1 to client 2, and clean disconnection.
- [ ] **Step 2: Run test to verify it fails**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_websocket.py -v`
Expected: FAIL.
- [ ] **Step 3: Implement `backend/app/services/gd_room_manager.py` and WebSocket endpoint**
Handle binary/base64 audio relaying between peers, participant presence lifecycle, and safe disconnection cleanup.
- [ ] **Step 4: Run test to verify it passes**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_websocket.py -v`
Expected: PASS.
- [ ] **Step 5: Commit checkpoint**
`git add backend/app/services/gd_room_manager.py backend/app/api/v1/endpoints/gd.py backend/tests/test_gd_websocket.py && git commit -m "feat(gd): implement real-time websocket gateway and audio relay"`

---

### Task 5: AI Moderator Logic & Live Transcription Aggregator

**Files:**
- Create: `backend/app/services/gd_moderator_service.py`
- Modify: `backend/app/services/gd_room_manager.py`
- Test: `backend/tests/test_gd_moderator.py`

**Interfaces:**
- Consumes: `LLMProviderManager`, `gd_transcripts` table
- Produces: `GDModeratorService.evaluate_moderation_turn(session_id, transcript, elapsed_time)` emitting `MODERATOR_SPEAK` events for Sarah Jenkins with rate-limit and 60-90s cooldown protection.

- [ ] **Step 1: Write the failing test for moderator decisions and transcript aggregation**
Test that Sarah generates a welcoming speech, intervenes on prolonged silence or monopolized speaking, provides time warning notices, and suppresses rapid consecutive speech.
- [ ] **Step 2: Run test to verify it fails**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_moderator.py -v`
Expected: FAIL with missing `GDModeratorService`.
- [ ] **Step 3: Implement `backend/app/services/gd_moderator_service.py`**
Implement autonomous moderation logic, topic introduction generator, balance tracker, and rate-limited interjections. Persist all transcript segments with participant IDs in `gd_transcripts`.
- [ ] **Step 4: Run test to verify it passes**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_moderator.py -v`
Expected: PASS.
- [ ] **Step 5: Commit checkpoint**
`git add backend/app/services/gd_moderator_service.py backend/tests/test_gd_moderator.py && git commit -m "feat(gd): add ai moderator service and transcript persistence"`

---

### Task 6: Individualized Evaluation Engine & Scorecard Service

**Files:**
- Create: `backend/app/services/gd_evaluator_service.py`
- Modify: `backend/app/api/v1/endpoints/gd.py` (Add evaluation endpoints)
- Test: `backend/tests/test_gd_evaluation.py`

**Interfaces:**
- Consumes: `gd_transcripts`, `gd_participants`, `LLMProviderManager`
- Produces: `gd_evaluator_service.evaluate_participant(session_id, participant_id)` returning 12 rubric category scores, evidence quotes, and improvement plan.

- [ ] **Step 1: Write the failing test for individualized evaluation**
Test evaluating two distinct participants from a shared transcript, ensuring each receives distinct scores and feedback grounded in their own utterances.
- [ ] **Step 2: Run test to verify it fails**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_evaluation.py -v`
Expected: FAIL.
- [ ] **Step 3: Implement `backend/app/services/gd_evaluator_service.py`**
Extract attributed participant segments, construct structured prompt scoring the 12 categories, validate JSON output schema, and persist to `gd_evaluations`.
- [ ] **Step 4: Run test to verify it passes**
Run: `.\venv\Scripts\python.exe -m pytest backend/tests/test_gd_evaluation.py -v`
Expected: PASS.
- [ ] **Step 5: Commit checkpoint**
`git add backend/app/services/gd_evaluator_service.py backend/tests/test_gd_evaluation.py && git commit -m "feat(gd): implement individualized 12-rubric evaluation engine"`

---

### Task 7: Frontend Candidate Workspace Dual-Track Dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/types/index.ts` (Add GD TypeScript types)
- Create: `frontend/src/lib/gd.ts` (GD API client service)
- Create: `frontend/src/components/dashboard/GDArenaCard.tsx`

**Interfaces:**
- Produces: Dual-track selector between "Personal Interview" and "Group Discussion Arena". Option A routes to existing flow, Option B allows creating/joining GD sessions and viewing GD history.

- [ ] **Step 1: Add GD TypeScript types and `frontend/src/lib/gd.ts`**
Define `GDSession`, `GDParticipant`, `GDInvitation`, `GDEvaluation` types and API client functions (`createSession`, `listSessions`, `validateInvite`, `getFeedback`).
- [ ] **Step 2: Update `frontend/src/app/dashboard/page.tsx` with Dual-Track Workspace**
Add a clean switcher tab / navigation pills at the top of the dashboard allowing the candidate to toggle between "Personal Interview" and "Group Discussion Arena" without altering any Personal Interview logic or state.
- [ ] **Step 3: Verify TypeScript compilation**
Run: `npx tsc --noEmit` in `frontend`.
Expected: 0 errors.
- [ ] **Step 4: Commit checkpoint**
`git add frontend/src/types/index.ts frontend/src/lib/gd.ts frontend/src/components/dashboard/GDArenaCard.tsx frontend/src/app/dashboard/page.tsx && git commit -m "feat(gd): add dual-track candidate workspace dashboard"`

---

### Task 8: Frontend GD Setup Wizard & Secure Join Page

**Files:**
- Create: `frontend/src/app/gd/setup/page.tsx`
- Create: `frontend/src/app/gd/join/[token]/page.tsx`
- Create: `frontend/src/components/gd/ShareInviteModal.tsx`

**Interfaces:**
- Produces:
  - `/gd/setup`: Topic generator, duration selector, rules configuration, instant link generator, WhatsApp/Email share.
  - `/gd/join/[token]`: Session overview, guest or user display-name input, mic permission check, device meter, join confirmation.

- [ ] **Step 1: Implement `frontend/src/app/gd/setup/page.tsx`**
Form with topic generator (calling backend LLM), preset categories, duration pills, max participants, and generated session share drawer.
- [ ] **Step 2: Implement `frontend/src/app/gd/join/[token]/page.tsx`**
Validates token on mount, displays session card (topic, host, slots), requests microphone access, displays live audio meter, and routes to `/gd/room/[sessionCode]`.
- [ ] **Step 3: Verify TypeScript compilation**
Run: `npx tsc --noEmit` in `frontend`.
Expected: 0 errors.
- [ ] **Step 4: Commit checkpoint**
`git add frontend/src/app/gd/setup/page.tsx frontend/src/app/gd/join/[token]/page.tsx frontend/src/components/gd/ShareInviteModal.tsx && git commit -m "feat(gd): implement gd setup wizard and secure join page"`

---

### Task 9: Real-Time GD Live Arena with Sarah Jenkins Moderator

**Files:**
- Create: `frontend/src/app/gd/room/[sessionCode]/page.tsx`
- Create: `frontend/src/components/gd/PeerAudioGrid.tsx`
- Create: `frontend/src/components/gd/SharedTranscriptPanel.tsx`
- Create: `frontend/src/lib/audio/AudioRelayClient.ts`

**Interfaces:**
- Consumes: `AvatarStage`, `AvatarEngine`, `BrowserSpeechToTextProvider`, WebSocket `/api/v1/gd/ws/{sessionCode}`
- Produces: Interactive live multi-user room with peer grid, speaking indicators, live transcript, countdown timer, leave/end controls, and Sarah Jenkins moderator lip-sync.

- [ ] **Step 1: Implement `AudioRelayClient.ts`**
Captures audio chunks via `MediaRecorder` / Web Audio and streams to WebSocket; receives incoming binary/base64 chunks from peers and plays through Web Audio `AudioContext`.
- [ ] **Step 2: Implement `PeerAudioGrid.tsx` and `SharedTranscriptPanel.tsx`**
Render peer avatar tiles with speaking waveform rings and auto-scrolling live transcript with speaker attribution tags.
- [ ] **Step 3: Implement `frontend/src/app/gd/room/[sessionCode]/page.tsx`**
Mount `AvatarStage` for Sarah Jenkins as AI moderator, connect WebSocket, bind `AudioRelayClient`, synchronize transcript, and handle countdown timer and session conclusion.
- [ ] **Step 4: Verify TypeScript compilation**
Run: `npx tsc --noEmit` in `frontend`.
Expected: 0 errors.
- [ ] **Step 5: Commit checkpoint**
`git add frontend/src/lib/audio/AudioRelayClient.ts frontend/src/components/gd/PeerAudioGrid.tsx frontend/src/components/gd/SharedTranscriptPanel.tsx frontend/src/app/gd/room/[sessionCode]/page.tsx && git commit -m "feat(gd): implement real-time gd room with sarah moderator and audio relay"`

---

### Task 10: Individualized GD Feedback Dashboard Page

**Files:**
- Create: `frontend/src/app/gd/feedback/[sessionId]/page.tsx`
- Create: `frontend/src/components/gd/GDScorecardReport.tsx`

**Interfaces:**
- Consumes: `/api/v1/gd/sessions/{session_id}/evaluations/me`
- Produces: 12-rubric score breakdown, strengths, improvement areas, missed opportunities, benchmark answer, and personalized practice plan.

- [ ] **Step 1: Implement `frontend/src/components/gd/GDScorecardReport.tsx`**
Rich UI with circular overall score (out of 5.0), 12 category progress bars, quotes from participant's transcript, and actionable practice drills.
- [ ] **Step 2: Implement `frontend/src/app/gd/feedback/[sessionId]/page.tsx`**
Fetches evaluation on mount, enforces user authorization, renders scorecard, and provides "Back to Dashboard" and "Review Full Transcript" actions.
- [ ] **Step 3: Verify TypeScript compilation**
Run: `npx tsc --noEmit` in `frontend`.
Expected: 0 errors.
- [ ] **Step 4: Commit checkpoint**
`git add frontend/src/components/gd/GDScorecardReport.tsx frontend/src/app/gd/feedback/[sessionId]/page.tsx && git commit -m "feat(gd): implement personalized gd feedback dashboard"`

---

### Task 11: End-to-End Integration, Regression Suite & Build Verification

**Files:**
- Create: `backend/tests/test_gd_e2e_integration.py`
- Test: Backend pytest full test suite
- Test: Frontend build (`npm run build`)

- [ ] **Step 1: Run comprehensive GD integration tests**
Verify complete flow: session creation -> invitation token -> peer join -> audio chunk relay -> transcript aggregation -> Sarah moderation -> session completion -> individualized evaluation.
- [ ] **Step 2: Run Personal Interview regression test suite**
Run all existing tests (`test_auth.py`, `test_avatar.py`, `test_health.py`, `test_interviews.py`, `test_jd_and_prep_pipeline.py`, `test_llm_service.py`, `test_phase3_interview_runtime.py`) to verify zero regressions.
- [ ] **Step 3: Verify frontend production build**
Run: `npm run build` in `frontend`.
Expected: Clean build with zero TypeScript or bundling errors.
- [ ] **Step 4: Browser verification**
Validate live room rendering, audio controls, dashboard tabs, and feedback screens.
- [ ] **Step 5: Prepare final report**
Compile comprehensive final report with architecture discovered, files changed, routes, audio transport details, and test outputs.
