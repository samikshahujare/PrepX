# Sarah Jenkins Final Avatar Quality & Behavior Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-grade, highly polished 3D AI interviewer avatar for Sarah Jenkins that faithfully reflects the reference asset (`sarah-clean.png`), featuring natural feminine proportions, an elegant dark ponytail hairstyle, professional navy blazer and cream blouse, subtle makeup and gold hoop earrings, natural idle behaviors, meaningful event-driven conversational responses, and audio-synchronized lip-syncing that articulates during speech and remains neutral during silence.

**Architecture:** 
1. Source 3D Rigged Asset Pipeline: MPFB / Blender 4.5 headless automation script generating high-detail rigged mesh, 53-bone humanoid armature, 74 ARKit & speech viseme shape keys, custom ponytail with hair tie and flowing locks, tailored navy suit with full sleeves, and PBR materials with subtle makeup.
2. WebGL 3D Runtime: `Local3DAvatarProvider` running Three.js, ACESFilmic tone mapping, ACES color grading, soft studio three-point lighting with desk bounce, resting seated desk posture with natural forearms on the desk, randomized blinking with double-blink flutter, conversational gaze tracking, and contextual hand gestures with natural resting recovery.
3. Audio Clock Lip-Sync: Speech visemes queued strictly in sync with Web Audio playback start, modulated in real-time by FFT frequency energy, returning immediately to neutral when audio stops or pauses.
4. Event-Driven Conversation: Semantic events (`CANDIDATE_GAVE_STRONG_ANSWER`, `CANDIDATE_GAVE_WEAK_ANSWER`, `INTERVIEWER_THINKING`, `INTERVIEWER_SPEAKING`, `INTERVIEW_PAUSED`) triggering affirmative nods, subtle warm smiles, attentive head tilts, and explanation gestures.

**Tech Stack:** Blender 4.5 Python API, MPFB2, glTF/GLB, Three.js, React, Next.js, Web Audio API, TypeScript, Edge-TTS / Web Speech.

**Spec:** User prompt: FINAL SARAH AVATAR QUALITY + BEHAVIOR PASS.

## Global Constraints
- Primary reference: `frontend/public/avatars/sarah-clean.png`
- Export target: `frontend/public/avatars/sarah.glb`
- Genuine 3D rigged humanoid character (no 2D planes, no HeyGen/LivePortrait/SadTalker)
- Ponytail is REQUIRED, naturally originating from back of head
- Only TWO arms, only TWO hands, resting naturally on desk, no duplicated limbs
- Mouth strictly neutral during silence; articulates dynamically when audio plays
- No old procedural avatar fallback
- Optimized for Intel UHD 620 WebGL performance (capped pixel ratio, frustum culling, zero per-frame allocations)

## Review Focus
1. Lip-sync timing bug where visemes timeout before audio starts playing — fixed by tying viseme queue start to `source.start(0)` and `audioCtx.currentTime`.
2. Arm and hand duplication or floating limbs — fixed by ensuring single skinned mesh, removing any extraneous procedural geometry, and configuring an anatomically correct seated arm rest pose.
3. Blocky or masculine appearance — fixed by tuning MPFB macro female parameters (gender=1.0, age=0.32, waist/chest/shoulder feminine proportions, delicate jawline, defined cheekbones, refined nose).
4. Messy hair / missing ponytail — fixed by constructing an authentic clean pulled-back scalp cap, gold/dark hair tie, and flowing ponytail cluster down the nape of the neck.
5. Random unnatural gestures — fixed by event-driven gesture triggers with smooth decay back to desk resting pose.

---

### Task 1: Rebuilding Sarah's 3D Rigged Asset in Blender/MPFB

**Files:**
- Create: `scratch/build_sarah_v3.py`
- Modify: `scratch/sarah_stage_rigged.blend` (output of stage script)
- Output: `scratch/sarah_v3.blend`

- [ ] **Step 1: Create Blender automation script for Sarah V3**
  - Initialize base female with natural proportions (gender 1.0, age 0.32, feminine shoulder width and waistline).
  - Apply delicate facial sculpting targets (oval face, defined cheekbones, refined straight nose, defined Cupid's bow, subtle warm smile).
  - Equip `toigo_female_suit_2` (full sleeves covering arms, tailored navy blazer, inner cream blouse).
  - Equip clean scalp hair base, remove bun, add hair tie and flowing ponytail cluster with natural volume.
  - Add small gold hoop earrings on left and right earlobes.
  - Apply 53-bone humanoid game_engine rig.
  - Load 74 ARKit and Microsoft speech viseme shape keys.
  - Apply warm glowing PBR skin material with subtle rose/mauve lipstick and cheek warmth.
  - Apply natural hazel-chocolate iris, dark pupil, warm sclera, and dark espresso eyelashes/eyebrows.

- [ ] **Step 2: Run script in Blender and verify exit code 0**
  Run: `blender --background --python scratch/build_sarah_v3.py`
  Expected: Success, output blend file saved.

---

### Task 2: Quality Inspection and Validation Renders

**Files:**
- Create: `scratch/render_sarah_v3_views.py`
- Output: `scratch/sarah_v3_front.png`, `scratch/sarah_v3_side.png`, `scratch/sarah_v3_back.png`, `scratch/sarah_v3_seated.png`

- [ ] **Step 1: Render 4 validation views at 1024x1024**
  - Front view closeup: verify feminine face, eyes, lips with subtle lipstick, eyebrows, forehead volume.
  - Side/profile view: verify ponytail silhouette, hair tie, feminine profile, ear hoop earring.
  - 3/4 Back view: verify ponytail originating cleanly from hair tie down the nape.
  - Seated upper-body view: verify blazer, cream blouse, shoulders, natural arms.

- [ ] **Step 2: Visually verify rendered images against `sarah-clean.png`**
  Run: View rendered images using `view_file`.

---

### Task 3: Export Final GLB Asset

**Files:**
- Output: `frontend/public/avatars/sarah.glb`

- [ ] **Step 1: Export GLB with skins, morph targets, and PBR materials**
  - Export from Blender with `export_morph=True`, `export_skins=True`, `export_materials='EXPORT'`.
  - Verify mesh count, polygon count, joint count, and 74 morph target names.

---

### Task 4: Upgrade Lip-Sync & Viseme Engine in `Local3DAvatarProvider.ts`

**Files:**
- Modify: `frontend/src/lib/avatar/VisemeEngine.ts`
- Modify: `frontend/src/lib/avatar/Local3DAvatarProvider.ts`

- [ ] **Step 1: Fix VisemeEngine audio start alignment**
  - Ensure viseme queue playback only starts when audio playback actually begins (`playAudioBuffer` start or speech synthesis `onstart`).
  - Calculate viseme timeline proportional to audio duration.

- [ ] **Step 2: Implement audio-synchronized mouth morphs**
  - Real-time Web Audio analyser frequency and RMS volume modulation.
  - Jaw opening and visemes scale with instantaneous audio power.
  - Absolute silence rule: when audio energy < threshold or isSpeakingActive is false, force all speech morphs to 0 and neutral silence morph to 1.0.

---

### Task 5: Event-Driven Behaviors & Natural Body Rigging

**Files:**
- Modify: `frontend/src/lib/avatar/Local3DAvatarProvider.ts`
- Modify: `frontend/src/lib/avatar/types.ts`

- [ ] **Step 1: Seated resting desk pose & natural arm rigging**
  - Pose both left and right arms naturally resting forward on the desk.
  - Smooth natural elbow angles and forearms.
  - Ensure zero duplicated limbs.

- [ ] **Step 2: Event-driven conversational behavior system**
  - Events: `INTERVIEWER_SPEAKING`, `CANDIDATE_STARTED_SPEAKING`, `CANDIDATE_GAVE_STRONG_ANSWER`, `CANDIDATE_GAVE_WEAK_ANSWER`, `INTERVIEWER_THINKING`, `INTERVIEWER_ASKING_QUESTION`, `INTERVIEWER_ENCOURAGING`, `INTERVIEW_PAUSED`.
  - Strong answer handler: triggers subtle warm smile, 1-2 affirmative nods, attentive eye contact, and smooth return.
  - Weak answer handler: attentive head tilt, thoughtful brow expression, zero smile.
  - Hand gestures: trigger only with conversational purpose (explaining, question, emphasis) and smoothly return to resting desk position.

- [ ] **Step 3: Natural idle breathing, saccades, and randomized blinking**
  - Randomized blink timer (2.0s to 5.5s) with 15% double-blink flutter.
  - Saccadic micro eye gaze adjustments.
  - Subtle chest/spine breathing motion.

---

### Task 6: Avatar Architecture Integration & Procedural Cleanup

**Files:**
- Modify: `frontend/src/lib/avatar/AvatarEngine.ts`
- Modify: `frontend/src/components/interview/AvatarStage.tsx`
- Modify: `frontend/src/app/interview/[sessionId]/page.tsx`

- [ ] **Step 1: Remove procedural avatar fallback from production path**
  - GLB load errors display clear user-facing error rather than silent procedural fallback.

- [ ] **Step 2: Connect interview answer evaluation to avatar events**
  - When candidate submits response and interviewer generates feedback, check semantic evaluation and dispatch `CANDIDATE_GAVE_STRONG_ANSWER` or `CANDIDATE_GAVE_WEAK_ANSWER` to `AvatarEngine`.

---

### Task 7: Verification & Browser Testing

**Files:**
- Tests: `scratch/test_avatar_browser_scenarios.py`

- [ ] **Step 1: TypeScript compilation check**
  Run: `npx tsc --noEmit` in `frontend`.
- [ ] **Step 2: Next.js production build check**
  Run: `npm run build` in `frontend`.
- [ ] **Step 3: Backend tests**
  Run: `pytest` in `backend`.
- [ ] **Step 4: Browser verification of Scenarios A through G**
  - Scenario A: Silence (mouth strictly neutral)
  - Scenario B: Sarah Speaks (mouth actively articulates in sync)
  - Scenario C: Audio Stops (lip-sync stops immediately)
  - Scenario D: Candidate Listens (Sarah attentive, nods, blinks)
  - Scenario E: Strong Answer (subtle smile + nod)
  - Scenario F: Thinking (gaze shift, head tilt, no mouth motion)
  - Scenario G: Explanation (meaningful hand gesture, returns to desk)
- [ ] **Step 5: Capture browser runtime screenshots for report**
