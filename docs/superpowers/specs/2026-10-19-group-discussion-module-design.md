# Group Discussion (GD) Module Design Specification

- **Date**: 2026-10-19
- **Project**: PrepX — Intelligent Interview Training Platform
- **Module**: Group Discussion (GD) Multi-User Simulation with AI Moderator (Sarah Jenkins)

---

## 1. Executive Summary & Objective

PrepX currently provides AI-powered 1-on-1 personal mock interviews with the Sarah Jenkins 3D avatar. This specification defines the architecture, database schema, real-time communication protocols, AI moderation mechanisms, and individual evaluation pipelines to add a complete **Group Discussion (GD)** module without modifying or breaking any existing Personal Interview functionality.

All existing Personal Interview capabilities (resume parsing, JD intelligence, duration planning, LLM provider failover, 3D avatar rendering, TTS/STT, feedback dashboards) remain untouched and fully operational.

---

## 2. High-Level Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              Frontend UI                               │
│  • Dashboard Switcher: [Personal Interview] | [Group Discussion Arena] │
│  • GD Setup & Topic Generator: /gd/setup                               │
│  • Secure Join Page: /gd/join/[inviteToken]                            │
│  • Real-Time GD Arena: /gd/room/[sessionCode]                          │
│    ├─ AvatarStage (Sarah Jenkins 3D Moderator, Lip-Sync, TTS)          │
│    ├─ Peer Video/Audio Tiles & Speaking Waveform Indicators            │
│    ├─ Shared Live Transcript Panel with Speaker Attribution Tags       │
│    └─ Discussion Controls & Remaining Countdown Timer                  │
│  • Personalized Feedback Dashboard: /gd/feedback/[sessionId]           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (REST) & WSS (WebSocket)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend Layer                           │
│  • /api/v1/gd/sessions (Create, list, get session details)             │
│  • /api/v1/gd/invitations (Generate token, validate join URL)          │
│  • /api/v1/gd/share (WhatsApp deep-link format, Email draft generation)│
│  • /api/v1/gd/ws/{session_code} (WebSocket Real-Time Gateway)          │
│    ├─ Presence Manager (Join, leave, reconnect, mute status)           │
│    ├─ Binary Audio Relay (Chunk broadcast to peer AudioContexts)       │
│    ├─ Transcript Aggregator (Authoritative per-speaker persistence)    │
│    └─ AI Moderator Decision Engine (Sarah Jenkins autonomous turns)    │
│  • /api/v1/gd/evaluations (Individualized rubric evaluations)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database Layer                          │
│  • gd_sessions (id, session_code, creator_id, topic, duration, status) │
│  • gd_participants (id, session_id, user_id, display_name, role)       │
│  • gd_invitation_tokens (id, session_id, token, expires_at, is_active) │
│  • gd_transcripts (id, session_id, participant_id, speaker_name, text) │
│  • gd_evaluations (id, session_id, participant_id, scores, feedback)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Migration

### Alembic Migration: `006_group_discussion_module.py`
Revision: `006_group_discussion_module`
Revises: `005_duration_deadline_feedback`

### Entities:

1. **`gd_sessions`**:
   - `id`: UUID (Primary Key, default uuid.uuid4)
   - `session_code`: VARCHAR(32) (Unique, indexed, e.g., `PREPX-GD-XXXXX`)
   - `creator_id`: UUID (ForeignKey `users.id`, nullable=False, indexed)
   - `topic`: VARCHAR(255) (nullable=False)
   - `topic_category`: VARCHAR(100) (nullable=False)
   - `topic_context`: TEXT (Optional JD or domain context)
   - `duration_minutes`: INTEGER (default=15, nullable=False)
   - `max_participants`: INTEGER (default=6, nullable=False)
   - `status`: VARCHAR(30) (default='waiting_for_participants', nullable=False)
     - Allowed values: `created`, `waiting_for_participants`, `in_progress`, `completed`, `cancelled`
   - `started_at`: TIMESTAMP WITH TIME ZONE (nullable=True)
   - `ended_at`: TIMESTAMP WITH TIME ZONE (nullable=True)
   - `created_at`: TIMESTAMP WITH TIME ZONE (default=now)
   - `updated_at`: TIMESTAMP WITH TIME ZONE (default=now, onupdate=now)

2. **`gd_participants`**:
   - `id`: UUID (Primary Key, default uuid.uuid4)
   - `session_id`: UUID (ForeignKey `gd_sessions.id`, ondelete='CASCADE', indexed)
   - `user_id`: UUID (ForeignKey `users.id`, ondelete='SET NULL', nullable=True, indexed)
   - `guest_id`: VARCHAR(100) (nullable=True, indexed)
   - `display_name`: VARCHAR(120) (nullable=False)
   - `is_host`: BOOLEAN (default=False, nullable=False)
   - `is_muted`: BOOLEAN (default=False, nullable=False)
   - `joined_at`: TIMESTAMP WITH TIME ZONE (default=now)
   - `left_at`: TIMESTAMP WITH TIME ZONE (nullable=True)

3. **`gd_invitation_tokens`**:
   - `id`: UUID (Primary Key, default uuid.uuid4)
   - `session_id`: UUID (ForeignKey `gd_sessions.id`, ondelete='CASCADE', indexed)
   - `token`: VARCHAR(64) (Unique, cryptographically secure token, indexed)
   - `expires_at`: TIMESTAMP WITH TIME ZONE (nullable=False)
   - `is_active`: BOOLEAN (default=True, nullable=False)
   - `created_at`: TIMESTAMP WITH TIME ZONE (default=now)

4. **`gd_transcripts`**:
   - `id`: UUID (Primary Key, default uuid.uuid4)
   - `session_id`: UUID (ForeignKey `gd_sessions.id`, ondelete='CASCADE', indexed)
   - `participant_id`: UUID (ForeignKey `gd_participants.id`, ondelete='SET NULL', nullable=True)
   - `speaker_name`: VARCHAR(120) (nullable=False)
   - `is_moderator`: BOOLEAN (default=False, nullable=False)
   - `message`: TEXT (nullable=False)
   - `timestamp_seconds`: FLOAT (default=0.0, nullable=False)
   - `sequence_number`: INTEGER (default=1, nullable=False)
   - `created_at`: TIMESTAMP WITH TIME ZONE (default=now)

5. **`gd_evaluations`**:
   - `id`: UUID (Primary Key, default uuid.uuid4)
   - `session_id`: UUID (ForeignKey `gd_sessions.id`, ondelete='CASCADE', indexed)
   - `participant_id`: UUID (ForeignKey `gd_participants.id`, ondelete='CASCADE', indexed)
   - `user_id`: UUID (ForeignKey `users.id`, ondelete='SET NULL', nullable=True, indexed)
   - `overall_score`: FLOAT (nullable=False)
   - `category_scores`: JSONB (nullable=False, default={})
   - `strengths`: JSONB (nullable=False, default=[])
   - `areas_for_improvement`: JSONB (nullable=False, default=[])
   - `communication_feedback`: TEXT (nullable=False)
   - `reasoning_feedback`: TEXT (nullable=False)
   - `listening_feedback`: TEXT (nullable=False)
   - `missed_opportunities`: JSONB (nullable=False, default=[])
   - `example_strong_response`: TEXT (nullable=False)
   - `personalized_plan`: JSONB (nullable=False, default={})
   - `created_at`: TIMESTAMP WITH TIME ZONE (default=now)

---

## 4. Backend Endpoints & Real-Time Gateway

### REST API Endpoints (`/api/v1/gd`)
- `POST /api/v1/gd/sessions`: Create a new GD session (requires auth).
- `GET /api/v1/gd/sessions`: List user's created and joined GD sessions.
- `GET /api/v1/gd/sessions/{session_id_or_code}`: Retrieve session metadata, topic, rules, participants.
- `POST /api/v1/gd/sessions/{session_id}/generate-topic`: AI-generate a relevant topic based on category and optional JD.
- `POST /api/v1/gd/sessions/{session_id}/invitations`: Generate/fetch unique invite token and share links.
- `GET /api/v1/gd/invitations/{token}/validate`: Public endpoint to validate join link, returning session topic, duration, host name, and available slots.
- `POST /api/v1/gd/invitations/{token}/join`: Register participant (authenticated user or validated guest) and issue session room ticket.
- `POST /api/v1/gd/sessions/{session_id}/end`: Conclude session manually by host.
- `GET /api/v1/gd/sessions/{session_id}/evaluations/me`: Retrieve current participant's individualized evaluation report.
- `POST /api/v1/gd/sessions/{session_id}/evaluate`: Trigger post-discussion evaluation generation.

### WebSocket Real-Time Gateway (`/api/v1/gd/ws/{session_code}`)
Protocol and Event Types:
1. **Client -> Server**:
   - `JOIN_ROOM`: Payload `{ participant_id, display_name, token }`.
   - `AUDIO_CHUNK`: Binary frame with leading 16-byte participant UUID header or JSON message `{ type: "audio_chunk", participant_id, chunk_base64 }`.
   - `TRANSCRIPT_UTTERANCE`: `{ participant_id, display_name, text, is_final, timestamp_seconds }`.
   - `MIC_STATE`: `{ participant_id, is_muted }`.
   - `START_DISCUSSION`: Sent by host to begin discussion.
   - `CONCLUDE_DISCUSSION`: Sent by host to conclude.
2. **Server -> Client Broadcast**:
   - `ROOM_STATE`: Full participant roster, session status, topic, remaining seconds.
   - `PARTICIPANT_JOINED`: Notify all connected peers of new member.
   - `PARTICIPANT_LEFT`: Notify all peers of disconnected member.
   - `AUDIO_BROADCAST`: Relays binary/base64 chunk from speaker to all other connected peers.
   - `TRANSCRIPT_SEGMENT`: Broadcast finalized utterance to live transcript panel.
   - `MODERATOR_SPEAK`: Event indicating Sarah Jenkins is speaking `{ text, gesture, expression, reason }`. Triggers avatar speech and lip-sync on all client screens.
   - `SESSION_ENDED`: Signals room closure and prompts clients to open individual evaluation dashboard.

---

## 5. Sarah Jenkins AI Moderator Runtime

### Principles:
1. Reuses existing `AvatarStage`, Three.js canvas, and `VisemeEngine` without any alterations to `sarah.glb`.
2. Sarah acts as an authoritative, professional facilitator, not an interrupting participant.
3. Moderation triggers are calculated server-side based on room events and speech turns:
   - **Opening Statement**: Welcomes participants, articulates the topic, sets expectations (listening, polite challenge, consensus), and starts countdown.
   - **Monopoly/Dominance Interruption**: When a single participant's cumulative speaking turn exceeds 75s without pause, Sarah gently interjects.
   - **Silence/Stall Recovery**: If no participant speaks for >15 seconds, Sarah introduces an illustrative perspective or counter-argument.
   - **Supporting Evidence Prompt**: When strong claims are voiced without context, Sarah requests elaboration.
   - **Time Notices**: Verbal cues at 5:00 remaining and 1:00 remaining.
   - **Closing Debrief**: Summarizes arguments and directs participants to their evaluation reports.
4. **Cooldown & Rate Limiting**: Minimum 60-90s between Sarah's spontaneous interventions to prevent over-moderation.

---

## 6. Live Audio Transport & Speaker Attribution

### Audio Streaming via WebSocket
- Browser captures microphone input via `navigator.mediaDevices.getUserMedia({ audio: true })`.
- Chunks captured every 250ms via `MediaRecorder` or `ScriptProcessorNode` are sent over the WebSocket.
- The FastAPI room manager forwards chunks to other participants in the room.
- Receivers feed chunks into Web Audio API `AudioContext` and output through user speakers.
- Visual audio meter / VAD indicates currently active speaker with a green glowing aura on their tile.

### Speaker Attribution
- Because audio and speech events originate from an authenticated participant connection, each utterance is authoritatively tagged with `participant_id`.
- Browser speech recognition transcribes candidate voice on their own machine, eliminating cross-talk interference.
- Finalized utterances are saved in `gd_transcripts` with verified `participant_id`.

---

## 7. Individualized GD Evaluation Engine

### 12 Evaluation Competency Categories:
1. Communication Clarity
2. Relevance to the Topic
3. Quality of Reasoning
4. Use of Supporting Examples / Evidence
5. Critical Thinking
6. Listening and Response to Others
7. Constructive Collaboration
8. Respectful Disagreement
9. Ability to Build on or Challenge Other Viewpoints
10. Conciseness and Organization
11. Participation Balance
12. Conclusion and Summarization

### Scoring & Evidence Grounding:
- Evaluates each participant using only their own attributed transcript utterances in relation to the group discussion.
- Evaluates on a 1.0 to 5.0 scale with evidence quotes.
- If a participant contributed minimally, the report accurately notes limited sample size rather than fabricating scores.
- Strict authorization guarantees participants can only inspect their own report.

---

## 8. Verification & Test Plan

1. **Unit & Backend Integration Tests**:
   - `test_gd_models_and_migration`: Verify database models, relations, cascades, and migrations.
   - `test_gd_session_creation`: Verify session creation, default rules, topic generation, and validation.
   - `test_gd_invitation_links`: Verify token security, join authorization, guest vs registered user handling, WhatsApp/Email link formatting.
   - `test_gd_room_state_and_websocket`: Verify WebSocket connection, participant presence, broadcast, audio relay, and transcript segment saving.
   - `test_gd_evaluation_engine`: Verify multi-LLM rubric scoring, evidence extraction, and access control.
   - `test_personal_interview_regression`: Full pass of existing personal interview tests to ensure zero regressions.
2. **Frontend Type Checking & Build**:
   - `npx tsc --noEmit` must pass with 0 errors.
   - `npm run build` must succeed.
3. **End-to-End Room Verification**:
   - Test two participants joining the same GD session.
   - Verify shared transcript, audio relay, and individual scorecard rendering.
