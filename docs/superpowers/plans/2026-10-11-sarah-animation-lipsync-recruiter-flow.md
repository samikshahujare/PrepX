# Sarah Animation, Lip-Sync, Interview Controls, and Recruiter-Style Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate unrequested head nodding, synchronize Sarah's mouth articulation with speech audio via GLB morph targets, remove misleading interviewer camera/mic controls from candidate UI, and implement a natural recruiter-style interview flow with fixed opening ("Tell me about yourself."), concise single-question turns, adaptive follow-ups, and structured final feedback.

**Architecture:**
- **Avatar Nodding & Expressions:** Remove periodic/random timers from `Local3DAvatarProvider.ts` and UI heuristics; add `onCandidateAnswerEvaluated(answerId, result)` with a unique ID deduplication guard to trigger at most one small acknowledgment nod for strong/adequate answers, and zero nods for weak/needs_followup answers.
- **Lip-Sync Pipeline:** Fix morph target mesh binding so `base` (74 morph targets) is never overwritten by zero-target accessory meshes; drive real speech visemes (`aa_02`, `ow_08`, `w_uw_07`, etc.) and `jawOpen` calibrated to audio playback and Web Audio Analyser energy; clamp cleanly to `sil_00` on audio completion, pause, or error.
- **Device Controls & Audio Isolation:** Strip misleading Sarah mic/camera toggle buttons from `AvatarStage.tsx`; retain candidate controls in `CandidateVideoPreview.tsx` and `InterviewControls.tsx`; harden Pause/Resume state transitions and STT isolation to discard stale callbacks during Sarah's speech.
- **Recruiter Flow:** Enforce static opening question "Tell me about yourself." across backend generators (`mock_generator.py`, `llm_generator.py`), engines (`mock_engine.py`, `llm_engine.py`), and frontend demo/session pages; structure questions into single concise turns with single adaptive follow-ups; show structured final feedback at completion.

**Tech Stack:** Next.js 14, TypeScript, Three.js, Web Audio API, FastAPI, Python 3.11, Edge-TTS, Pydantic, TailwindCSS/Vanilla CSS.

**Spec:** User request: PrepX — Focused Final Fix: Sarah Animation, Lip-Sync, Interview Controls and Recruiter-Style Questions.

## Global Constraints

- Do NOT modify Sarah's 3D mesh, geometry, hair, ponytail, eyebrows, eyelashes, lipstick, makeup, clothing, desk, GLB model, lighting, camera framing, or overall page layout.
- Do NOT regenerate avatar or edit Blender source files.
- Do NOT introduce any new avatar providers or external paid avatar APIs.
- Preserve working features, session authentication, and database schemas.
- Maintain document and comment integrity.

## Review Focus

1. **Morph Target Binding Overwrite:** If `sMesh.morphTargetDictionary` is empty `{}` on accessory meshes (e.g. `fem_suit2`), it must not overwrite the real face mesh `base` (74 targets).
2. **Nod Multi-Fire:** Submitting an answer or transitioning state must never fire multiple nodding cycles; deduplicate strictly using a finalized `answerId` set.
3. **TTS-STT Acoustic Leakage:** Candidate STT must ignore any incoming speech recognition results while Sarah is speaking or while the state is paused.
4. **Pause/Resume Replay Prevention:** Resuming a paused session where the candidate was already answering must return to `listening` without replaying the question audio from the beginning.
5. **Question Conciseness:** No generated interviewer question or follow-up may bundle multiple independent questions into one paragraph.

---

### Task 1: Eliminate Continuous Nodding & Add Answer-Evaluated Acknowledgment

**Files:**
- Modify: `frontend/src/lib/avatar/Local3DAvatarProvider.ts`
- Modify: `frontend/src/lib/avatar/AvatarEngine.ts`
- Modify: `frontend/src/components/interview/AvatarStage.tsx`
- Modify: `frontend/src/app/interview/[sessionId]/page.tsx`
- Test: `frontend/tests/avatar-nodding.test.ts`

**Interfaces:**
- Produces: `Local3DAvatarProvider.onCandidateAnswerEvaluated(answerId: string, result: 'strong' | 'adequate' | 'needs_followup'): void`
- Produces: `AvatarEngine.onCandidateAnswerEvaluated(answerId: string, result: 'strong' | 'adequate' | 'needs_followup'): void`
- Consumes: Evaluated answer metadata from `handleSubmitResponse` in `page.tsx`

- [ ] **Step 1: Write test for nodding behavior and answer evaluation**

Create `frontend/tests/avatar-nodding.test.ts`:
Verify that:
1. `triggerNod` is NOT called by periodic listening timers.
2. `onCandidateAudioLevel` does NOT trigger random nods.
3. `onCandidateAnswerEvaluated` with `strong` triggers exactly one nod.
4. Duplicate `onCandidateAnswerEvaluated` with the same `answerId` is ignored.
5. `onCandidateAnswerEvaluated` with `needs_followup` does NOT trigger a nod.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ts-node --transpile-only frontend/tests/avatar-nodding.test.ts` (or standard test runner).

- [ ] **Step 3: Remove automatic/periodic nodding in `Local3DAvatarProvider.ts`**

1. Remove `nextListenNodTime` and the timer check in `updateHeadAndNeck(delta, time)`.
2. Remove `Math.random() < 0.08` nod trigger in `onCandidateAudioLevel(level)`.
3. In `setState(state)`: remove `this.triggerNod(0.08)` under `case "SMILING": case "ENCOURAGING":`.
4. In `triggerGesture(gesture)`: remove `this.triggerNod(0.08)` from `case "NOD_ENCOURAGING"`.
5. Implement `onCandidateAnswerEvaluated(answerId: string, result: 'strong' | 'adequate' | 'needs_followup')`:
   - Check `evaluatedAnswerIds.has(answerId)`. If present, return immediately.
   - Add `answerId` to `evaluatedAnswerIds`.
   - If `result === "strong"` or `result === "adequate"`, call `this.triggerNod(0.065)` and `this.setExpression("WARM_SMILE", 0.6)`.
   - If `result === "needs_followup"`, maintain attentive neutral expression with zero nods.
6. Expose `onCandidateAnswerEvaluated` on `window.__sarahAvatar`.

- [ ] **Step 4: Remove spurious nod triggers in `AvatarStage.tsx` and integrate in `page.tsx`**

1. In `AvatarStage.tsx` lines 185-206: remove `engineRef.current.onCandidateGaveStrongAnswer()` from `case "speaking":`.
2. In `frontend/src/app/interview/[sessionId]/page.tsx` in `handleSubmitResponse`:
   - Compute `result`: if `action === "STRONG_ANSWER" || (score !== undefined && score >= 7.5)` -> `"strong"`; else if `score !== undefined && score >= 5.0` -> `"adequate"`; else -> `"needs_followup"`.
   - Pass unique `answerId` (`t_${Date.now()}` or transcript ID) to `(window as any).__sarahAvatar?.onCandidateAnswerEvaluated(answerId, result)` and `AvatarEngine`.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx tsc --noEmit`

---

### Task 2: Fix Speech Lip-Sync & Morph Synchronization

**Files:**
- Modify: `frontend/src/lib/avatar/Local3DAvatarProvider.ts`
- Modify: `frontend/src/lib/avatar/VisemeEngine.ts`
- Test: `frontend/tests/avatar-lipsync.test.ts`

**Interfaces:**
- Produces: Robust morph target mapping on real `base` mesh in `sarah.glb`.
- Produces: Dynamic `jawOpen` and phoneme morph animation driven by audio playback clock & Web Audio analyser energy.

- [ ] **Step 1: Write test for lip-sync lifecycle and morph target mapping**

Create `frontend/tests/avatar-lipsync.test.ts`:
Verify that:
1. Mouth morph targets are neutral (`sil_00 = 1.0`, others `0.0`) when `isSpeakingActive` is false.
2. `updateLipSync` applies visemes and `jawOpen` only when audio is active.
3. `stopSpeaking()` immediately clamps all visemes and `jawOpen` to neutral.
4. Target names match GLB morph dictionary (`aa_02`, `ow_08`, `w_uw_07`, `jawOpen`, etc.).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ts-node --transpile-only frontend/tests/avatar-lipsync.test.ts`.

- [ ] **Step 3: Fix `Local3DAvatarProvider.ts` mesh discovery and lip-sync articulation**

1. In `loadModel` traverse:
   ```ts
   if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
     const sMesh = mesh as THREE.SkinnedMesh;
     if (
       sMesh.morphTargetDictionary &&
       Object.keys(sMesh.morphTargetDictionary).length > 0 &&
       sMesh.morphTargetInfluences &&
       sMesh.morphTargetInfluences.length > 0
     ) {
       this.morphMesh = sMesh;
       this.morphDictionary = sMesh.morphTargetDictionary;
       this.morphInfluences = sMesh.morphTargetInfluences;
     }
   }
   ```
2. In `updateLipSync(delta)`:
   - Calculate `audioEnergy` from analyser with calibrated gain:
     ```ts
     const avg = sum / this.audioFrequencyData.length;
     audioEnergy = Math.min(1.8, (avg / 64) * 1.5);
     ```
   - Scale effective intensity:
     ```ts
     const effectiveIntensity = Math.min(
       1.0,
       intensity * Math.max(0.4, this.currentAudioEnergy)
     );
     ```
   - Apply realistic `jawOpen` weights (0.30 - 0.55 * effectiveIntensity for open vowels `aa`, `oh`, `ou`, 0.02 for `mbp`).
   - In `flushMorphTargets`, guarantee direct update to `this.morphMesh.morphTargetInfluences[idx] = nextVal`.
3. In `stopSpeaking()`:
   - Ensure all morph target values immediately set to 0.0 and `sil_00` to 1.0.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc --noEmit`.

---

### Task 3: Remove Sarah Device Controls & Polish Interview Controls

**Files:**
- Modify: `frontend/src/components/interview/AvatarStage.tsx`
- Modify: `frontend/src/components/interview/AvatarProvider.tsx`
- Modify: `frontend/src/app/interview/[sessionId]/page.tsx`
- Test: `frontend/tests/avatar-controls.test.ts`

**Interfaces:**
- Consumes: `onPauseInterview`, `onResumeInterview`, `onEndInterview`
- Produces: Clean AvatarStage overlay without mic/camera toggles; candidate-only controls preserved in `CandidateVideoPreview` and `InterviewControls`.

- [ ] **Step 1: Write test for UI control visibility and Pause/Resume isolation**

Create `frontend/tests/avatar-controls.test.ts`:
Verify that:
1. `AvatarStage` does NOT render camera or microphone buttons on Sarah's video tile.
2. `handlePauseInterview` stops Sarah TTS playback and disables candidate STT.
3. `handleResumeInterview` does NOT replay the question if candidate was already in `listening` state.
4. Candidate STT callbacks arriving during `speaking` or `paused` states are discarded.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Clean `AvatarStage.tsx` overlay controls**

1. Remove `onToggleMic` and `onToggleCamera` buttons from lines 483-509 in `AvatarStage.tsx`.
2. Remove `onToggleMic` and `onToggleCamera` from `AvatarStageProps` and `AvatarProviderProps`.
3. Keep candidate device controls exclusively in `CandidateVideoPreview.tsx` and bottom `InterviewControls.tsx`.

- [ ] **Step 4: Harden Pause / Resume / End and STT isolation in `page.tsx`**

1. Introduce `wasInterviewerSpeakingBeforePauseRef` to track whether Sarah was speaking when paused.
2. On `handlePauseInterview`:
   - Stop TTS: `(window as any).__sarahAvatar?.stop?.()`.
   - Stop STT: `sttProviderRef.current?.stopListening()`.
   - Set state to `"paused"`.
3. On `handleResumeInterview`:
   - If `wasInterviewerSpeakingBeforePauseRef.current` was true: resume/replay question.
   - Else: immediately resume candidate listening without replaying question!
4. In `startListeningForCandidate`:
   - Guard `onInterimResult` and `onFinalResult`: if `interviewState !== "listening"` or `isSpeaking`, ignore transcript!

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsc --noEmit`.

---

### Task 4: Recruiter-Style Question Flow (Fixed Opening, Concise Questions, Adaptive Follow-Ups, Final Feedback)

**Files:**
- Modify: `backend/app/adapters/question_generator/mock_generator.py`
- Modify: `backend/app/adapters/question_generator/llm_generator.py`
- Modify: `backend/app/adapters/interview_engine/mock_engine.py`
- Modify: `backend/app/adapters/interview_engine/llm_engine.py`
- Modify: `backend/app/services/interview_service.py`
- Modify: `frontend/src/app/interview/[sessionId]/page.tsx`
- Modify: `frontend/src/components/interview/InterviewCompletedModal.tsx`
- Test: `backend/tests/test_recruiter_flow.py`

**Interfaces:**
- Produces: Question 1 strictly fixed to `"Tell me about yourself."`
- Produces: Single concise questions per turn without multi-part paragraph questions.
- Produces: Single adaptive follow-up per candidate response.
- Produces: Structured final feedback on completion.

- [ ] **Step 1: Write backend tests for recruiter-style questions and flow**

Create `backend/tests/test_recruiter_flow.py`:
Verify that:
1. First generated question is always `"Tell me about yourself."` in both mock and LLM generators.
2. Initial greeting introduces Sarah concisely without placeholders and asks `"Tell me about yourself."`
3. Every middle question contains only one concise primary question.
4. Follow-up is asked as a single turn, and answering a follow-up advances to the next topic.
5. Structured feedback summary is provided upon session completion.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_recruiter_flow.py -v`.

- [ ] **Step 3: Update `mock_generator.py` and `llm_generator.py`**

1. In `mock_generator.py`:
   - Question 1: strictly `"Tell me about yourself."`, category `"Opening"`.
   - Question 2: `"Tell me about your {project_ref} project."` (concise single question).
   - Questions 3-10: concise, single-question technical and scenario questions based on resume skills, role, and JD.
2. In `llm_generator.py`:
   - System prompt & instructions:
     - Question 1 MUST BE strictly: `"Tell me about yourself."`
     - Each question must be ONE concise primary question (1-2 sentences maximum). Do not bundle multiple sub-questions.

- [ ] **Step 4: Update `mock_engine.py` and `llm_engine.py`**

1. In `generate_initial_greeting`:
   - Concisely introduce Sarah without placeholders.
   - End with: `"Tell me about yourself."`
2. In `process_candidate_response`:
   - If follow-up: ask ONE sharp, concise follow-up question.
   - If candidate already answered a follow-up: briefly acknowledge and transition to next primary question. Never ask multiple questions in one turn.

- [ ] **Step 5: Update `frontend/src/app/interview/[sessionId]/page.tsx` demo mode & flow**

1. Set demo mode question 1 to `"Tell me about yourself."`
2. Update demo greeting to end concisely with `"Tell me about yourself."`
3. Ensure follow-ups are single concise questions.

- [ ] **Step 6: Update `InterviewCompletedModal.tsx` with structured feedback**

1. Display structured summary sections:
   - Technical Strengths
   - Knowledge Gaps & Areas to Improve
   - Answer Relevance & Completeness
   - Suggested Practice Topics
2. Populate from session data or transcripts.

- [ ] **Step 7: Run backend and frontend tests to verify they pass**

Run: `pytest backend/tests/test_recruiter_flow.py -v`
Run: `npx tsc --noEmit` in `frontend`

---

### Task 5: Complete Verification, Build, and Browser Testing

**Files:**
- Test: Entire frontend and backend suites

- [ ] **Step 1: Run TypeScript check**
Run: `npx tsc --noEmit` in `frontend`.
Expected: 0 errors.

- [ ] **Step 2: Run frontend production build**
Run: `npm run build` in `frontend`.
Expected: Successful build.

- [ ] **Step 3: Run backend test suite**
Run: `pytest backend/tests/` using python in backend virtualenv.
Expected: PASS.

- [ ] **Step 4: Run live browser interview verification**
Verify in browser subagent:
- Start interview: Sarah greets candidate and asks "Tell me about yourself."
- No periodic or random head nodding during idle or listening.
- Sarah's lips visibly articulate speech audio.
- When audio stops, mouth cleanly resets to neutral with no open jaw.
- No camera/mic toggle buttons appear on Sarah's avatar tile.
- Candidate device controls work.
- Pause/resume functions properly without question replay or transcript corruption.
- Completing interview shows structured final feedback.

---
