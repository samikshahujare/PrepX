# PrepX Group Discussion (GD) Production-Readiness Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the PrepX Group Discussion (GD) module into a realistic, reliable online multiplayer group discussion platform with public external invitation links, guest participation, reliable real-time audio, AI moderation by Sarah Jenkins with 3D avatar lip-sync, and isolated individual evaluations.

**Architecture:** A FastAPI backend with SQLAlchemy/PostgreSQL provides REST and WebSocket channels. The public invitation system uses configurable canonical application and API origins. Real-time audio streaming uses self-contained linear PCM with scheduled Web Audio timeline playback (avoiding WebM header loss). Speech-to-text ensures clean speaker attribution while avoiding Sarah's TTS echo. Sarah's moderation coordinates with avatar visemes, while individual 12-rubric evaluations are private to each participant.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Three.js (AvatarStage/VisemeEngine), Web Audio API, Web Speech API, FastAPI, SQLAlchemy, PostgreSQL, Multi-LLM Failover (Gemini, NVIDIA, Groq, OpenRouter).

---

## Root Cause Diagnosis

1. **Localhost Invitation URLs**:
   - `backend/app/api/v1/endpoints/gd.py:144` read `request.headers.get("origin") or "http://localhost:3000"`.
   - `frontend/src/app/gd/setup/page.tsx:129` concatenated `window.location.origin` with the backend join URL, producing doubled URLs or hard-coding `http://localhost:3000`.
   - Missing canonical public origin configuration (`NEXT_PUBLIC_APP_URL` and `APP_PUBLIC_URL`).
2. **Guest Join Blockers**:
   - `GET /api/v1/gd/sessions/{identifier}` was restricted with `get_current_active_user`, which returned 401 Unauthorized for guests navigating to the GD room.
   - `myParticipant` fallback in `room/[sessionCode]/page.tsx` invented temporary IDs (`p_${Date.now()}`) which failed backend validation and caused WebSocket disconnects.
3. **WebSocket Host Construction**:
   - `frontend/src/app/gd/room/[sessionCode]/page.tsx:211` set `host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host`. On any external host, domain, or IP, it connected WebSocket to the frontend port rather than the backend!
4. **Audio Relay Decoding Failure**:
   - `AudioRelayClient.ts` transmitted 250ms chunks from `MediaRecorder(audio/webm;codecs=opus)`. Only the first chunk contains EBML container headers; subsequent slices cannot be decoded independently via `decodeAudioData()`, silently dropping all audio packets.
5. **WebSocket Lifecycle Mismatch**:
   - `test_gd_websocket.py` expects `"ROOM_STATE"` and `"AUDIO_RELAY"`, whereas backend was sending `"SYNC_STATE"` and `"AUDIO_CHUNK"`.
6. **STT Echo & Deduplication**:
   - Browser STT listened while Sarah was speaking, transcribing Sarah's own voice and attributing it to the participant.
7. **Evaluation Authorization for Guests**:
   - `/sessions/{session_id}/evaluations/me` required an authenticated user account, preventing invited guests from retrieving their evaluation.

---

## Implementation Tasks

### Task 1: Canonical Public Origin Configuration & Invitation URL Generation (Stage 1)
- Add `APP_PUBLIC_URL` and `FRONTEND_URL` to backend `Settings` with CORS support.
- Add `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_WS_URL` to frontend configuration.
- Update `GDService.format_share_links` and `backend/app/api/v1/endpoints/gd.py` to use canonical public origin.
- Update `frontend/src/app/gd/setup/page.tsx` to handle absolute URLs properly and display a clear dev warning if localhost is used without tunnel.

### Task 2: Guest Authorization & Room Loading (Stage 1.4 & 2.1)
- Allow `GET /api/v1/gd/sessions/{identifier}` to serve session metadata to participants holding a valid participant ID or guest token.
- Update `frontend/src/app/gd/join/[token]/page.tsx` and `room/[sessionCode]/page.tsx` to preserve participant identity in storage and session context.

### Task 3: WebSocket Gateway Alignment & URL Construction (Stage 2.2)
- Fix frontend WebSocket URL generation using configured backend origin and correct protocol (`ws://` vs `wss://`).
- Standardize message types in `GDRoomManager` to emit `ROOM_STATE` (while supporting `SYNC_STATE`) and `AUDIO_RELAY` (while supporting `AUDIO_CHUNK`).
- Fix `backend/tests/test_gd_websocket.py` to verify full lifecycle passes.

### Task 4: Reliable Multi-Participant Audio Transport (Stage 3)
- Refactor `AudioRelayClient.ts` to transmit self-contained 16-bit PCM mono chunks over WebSocket.
- Implement scheduled playback timeline via Web Audio API (`AudioContext.currentTime`) with jitter buffer to prevent gaps or overlapping audio.
- Ensure mute stops transmission and leaving cleans up audio tracks.

### Task 5: Live Transcription Attribution & Echo Prevention (Stage 4)
- Suppress or pause participant STT capture while Sarah's TTS is actively speaking.
- Add sequence IDs to transcripts and deduplicate in backend.
- Provide a text chat fallback in room when Web Speech API is unsupported.

### Task 6: AI Moderator Turn Coordination & Avatar Visemes (Stage 5)
- Ensure Sarah's opening, interventions, and closing emit consistent events and trigger `AvatarStage` visemes.
- Maintain cooldowns and authoritative session timer.

### Task 7: Individual Feedback Access & Privacy Isolation (Stage 6)
- Provide `/api/v1/gd/sessions/{session_id}/evaluations/participant/{participant_id}` or query parameter supporting guest participants.
- Enforce strict privacy so participants only see their own evaluation.
- Handle zero/short speech with honest "insufficient evidence" feedback.

### Task 8: Verification & Regression Testing (Stages 8 & 9)
- Run pytest suite across backend (`pytest tests -v`).
- Run TypeScript check (`npx tsc --noEmit`) and build (`npm run build`).
- Verify personal interview tests remain 100% passing.
- Generate final evidence-based report.
