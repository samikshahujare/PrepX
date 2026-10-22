# Sarah Jenkins Avatar Final High-Quality Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Sarah Jenkins 3D avatar into an exceptionally polished, feminine, lifelike AI technical interviewer faithful to `sarah-clean.png`—featuring smooth feminine facial contours, visible arched eyebrows, subtle rose lipstick, natural warm eyes and eyelashes, a clean high ponytail with zero bangs covering the forehead, feminine shoulder and blazer silhouette, natural seated posture behind a realistic wooden desk with forearms and hands resting naturally on the surface, expressive subtle conversational gestures, strict audio-driven lip-sync, and speaker-isolated microphone gating.

**Architecture:** 
1. Build and export pipeline via Blender 4.5 Python scripting (`scratch/build_and_export_final_sarah.py`), shaping MakeHuman/MPFB base mesh with feminine facial targets, narrower feminine shoulders, refined nose, jaw, and lips;
2. Generate pristine 2048x2048 skin diffuse texture with warm bronze undertone, clean smooth cheeks, defined dark brown arched eyebrows, subtle eyeliner and dark lashes, natural cheek contour, and muted rose lipstick;
3. Construct clean high ponytail originating from the upper crown/back with rich brunette PBR material and completely open forehead (no bangs);
4. Configure Three.js runtime in `Local3DAvatarProvider.ts` with natural wooden desk, camera framing matching the reference, natural resting forearm/hand pose with curled fingers touching the desk surface, subtle conversational gestures that return to the desk, randomized blinking, saccades, facial morph targets, and strict audio-clock lip-sync;
5. Validate microphone/TTS isolation so candidate audio and Sarah speech never bleed into each other.

**Tech Stack:** Blender 4.5.14 LTS (Python API, MPFB / MakeHuman), Three.js (WebGL, PBR MeshStandardMaterial, Morph Targets, SkinnedMesh), Next.js 14, TypeScript, Web Audio API, Web Speech API / Edge TTS, Chrome DevTools Protocol (CDP).

**Spec:** User prompt requirements for Sarah Jenkins avatar refinement matching `frontend/public/avatars/sarah-clean.png`.

## Global Constraints
- PRIMARY REFERENCE: `frontend/public/avatars/sarah-clean.png`.
- NO BANGS: Forehead must remain completely visible; no fringe or hair covering forehead, eyebrows, or eyes.
- CLEAN HIGH PONYTAIL: Hair pulled neatly back, high ponytail originating at crown/upper back.
- SMOOTH FEMININE FACE: No wrinkles, no spots, no acne, smooth shading, natural feminine proportions.
- VISIBLE EYEBROWS & LIPSTICK: Defined dark brown eyebrows, subtle rose/nude-rose lipstick clearly visible under normal browser lighting.
- FEMININE BODY & SHOULDERS: Softer shoulder width, natural feminine slope, no oversized masculine shoulders.
- DESK & RESTING HANDS: Wooden desk in front; forearms supported; hands resting naturally on desk with relaxed curled fingers (no floating splayed claws).
- STRICT AUDIO/LIP-SYNC: Lip movement occurs only when Sarah audio plays; stops immediately when audio stops.
- MIC SEPARATION: Candidate STT OFF while Sarah speaks; ON when candidate speaks; Sarah speech never transcribed.

## Review Focus
- Hands floating or splaying: Ensure finger bones are curled and wrists/forearms rest directly on desk surface at correct Y/Z coordinates.
- Bangs reappearing: Verify zero hair strands fall across forehead or obstruct eyebrows/eyes.
- Eyebrows/eyelashes hidden: Ensure eyebrow and eyelash meshes are properly parented/skinned and texture has distinct brow/lash rendering.
- Mouth moving when silent: Verify viseme engine strictly clamps to neutral (`sil_00`) whenever Sarah is not speaking.
- Audio bleed into STT: Verify `speakInterviewerMessage` immediately aborts STT listening and enforces transition guard before re-opening.

---

### Task 1: Sculpt Feminine Facial Proportions & Refine Anatomy in Blender

**Files:**
- Modify: `scratch/build_and_export_final_sarah.py`

**Interfaces:**
- Produces: Updated `bm` (Sarah_Mesh) with feminine facial proportions and narrower shoulders matching `sarah-clean.png`.

- [ ] **Step 1: Update macro proportions and facial sculpt targets**
  - Set `macro["muscle"] = 0.20`, `macro["weight"] = 0.38` (slender natural feminine build).
  - Add feminine jaw targets: `("jaw-angle-decr", 0.30)`, `("jaw-width-decr", 0.35)`, `("chin-bones-decr", 0.25)`, `("chin-width-decr", 0.38)`, `("chin-height-decr", 0.18)`.
  - Add feminine shoulder and torso targets: `("body-shoulders-width-decr", 0.35)`, `("body-torso-width-decr", 0.22)`.
  - Refine nose: straight slim bridge `("nose-width1-decr", 0.35)`, `("nose-width2-decr", 0.38)`, `("nose-width3-decr", 0.30)`, `("nose-point-width-decr", 0.28)`, `("nose-nostrils-width-decr", 0.25)`.
  - Refine eyes: soft feminine almond shape `("l-eye-corner1-down", 0.08)`, `("r-eye-corner1-down", 0.08)`, `("l-eye-corner2-up", 0.15)`, `("r-eye-corner2-up", 0.15)`.

- [ ] **Step 2: Run Blender test script to verify facial proportions and measure mesh bounds**
  - Execute: `& "C:\Users\Admin\AppData\Local\Programs\Blender Foundation\Blender 4.5\blender.exe" --background --python scratch/test_sculpt_targets.py`
  - Expected: Clean mesh generation without errors.

---

### Task 2: Create Pristine 2048x2048 Skin Diffuse Texture with Natural Makeup, Arched Eyebrows, and Rose Lipstick

**Files:**
- Create: `scratch/prepare_sarah_skin_v4.py`
- Produces: `scratch/sarah_skin_diffuse_v4.png`, `frontend/public/avatars/sarah_skin_diffuse_enhanced.png`

**Interfaces:**
- Consumes: High-resolution MakeHuman female bronze skin (`young_lightskinned_female_diffuse6.png` or `Bronze.png`).
- Produces: Diffuse map with:
  - Clean smooth complexion without wrinkles, acne, or harsh pores.
  - Symmetrical, naturally arched dark espresso/chocolate eyebrows positioned above the eyes.
  - Defined upper eyeliner tightline and dark eyelash base.
  - Soft peachy-rose cheek contour on high cheekbones.
  - Rich, clearly defined muted rose / mauve-pink lipstick with natural lip contours.

- [ ] **Step 1: Write `scratch/prepare_sarah_skin_v4.py` using Pillow with Gaussian blending**
  - Locate exact UV coordinates for eyebrows (Y: 1025-1095 and 885-955; X: 1680-1700), lips (X: 1835-1880; Y: 960-1040), cheeks (X: 1720-1780; Y: 850 & 1130).
  - Draw natural tapered hair strokes for eyebrows, smooth gradient for lipstick, soft cheek blush.
  - Smooth scalp and forehead hairline region.

- [ ] **Step 2: Run script to generate `sarah_skin_diffuse_v4.png` and crop previews**
  - Execute: `python scratch/prepare_sarah_skin_v4.py`
  - Verify face crop and mouth crop using `view_file` to ensure eyebrows and lipstick look natural and match `sarah-clean.png`.

---

### Task 3: Sculpt Clean High Ponytail Hairstyle with Zero Bangs

**Files:**
- Modify: `scratch/build_and_export_final_sarah.py`

**Interfaces:**
- Produces: `hair_obj` in Blender with:
  - Clean hairline pulled back smoothly off forehead;
  - Zero bangs, fringe, or hair obstructing forehead, eyebrows, or eyes;
  - High ponytail originating at the upper crown / back (Z ~ 1.62, Y ~ 0.05);
  - Hair tie torus band;
  - Cascading ponytail strands curving upward and back down, with side volume visible from front view;
  - Properly parented to armature `head` bone.

- [ ] **Step 1: Implement ponytail geometry in `build_and_export_final_sarah.py`**
  - Use smoothed scalp base mesh with clean forehead hairline.
  - Construct ponytail curves originating from crown with natural flare and tapering.
  - Eliminate all front wisps or bangs.
  - Parent to armature and assign 1.0 weight to `head` vertex group.

- [ ] **Step 2: Render 4-angle views in Blender (Front, 3/4 Left, 3/4 Right, Side) and inspect**
  - Verify zero bangs on forehead, visible high ponytail silhouette, and clean hairline.

---

### Task 4: Tailored Navy Blazer Silhouette, Gold Earrings, Rigging, and Viseme Shape Keys

**Files:**
- Modify: `scratch/build_and_export_final_sarah.py`

**Interfaces:**
- Produces: Final `sarah.glb` with:
  - Narrowed feminine blazer shoulders conforming to the body;
  - Material slot 0: Navy Blazer (`#192536`, roughness 0.72);
  - Material slot 1: Cream V-neck Blouse (`#f4efe7`, roughness 0.55);
  - Subtle gold hoop earrings parented to head;
  - 53-bone humanoid rig with proper weights;
  - 74 ARKit morph targets + Microsoft speech visemes baked into `Sarah_Mesh`;
  - Exported to `frontend/public/avatars/sarah.glb`.

- [ ] **Step 1: Update blazer shoulder geometry in Python script**
  - Conform suit shoulders to the feminine body scale.
  - Ensure eyebrows and eyelashes meshes (if present) are assigned to `head` vertex group or joined.
  - Export GLB with materials, skins, and morph targets.

- [ ] **Step 2: Run build script to generate `sarah.glb`**
  - Execute: `& "C:\Users\Admin\AppData\Local\Programs\Blender Foundation\Blender 4.5\blender.exe" --background --python scratch/build_and_export_final_sarah.py`
  - Verify export size and log output.

---

### Task 5: Three.js Environment, Wooden Desk, Camera Framing, and Materials Setup

**Files:**
- Modify: `frontend/src/lib/avatar/Local3DAvatarProvider.ts`

**Interfaces:**
- Consumes: `sarah.glb`, `sarah_skin_diffuse_enhanced.png`, `sarah_eye_iris.png`.
- Produces: Professional interview scene matching `sarah-clean.png`.

- [ ] **Step 1: Remove procedural bangs from `Local3DAvatarProvider.ts`**
  - Delete `buildHairAndPonytail()` or update it so it does NOT add any curtain bangs or facial strands.
  - Remove code hiding eyebrow/eyelash meshes.

- [ ] **Step 2: Refine wooden desk position and appearance**
  - Position desk top directly at height `Y = -0.22`, depth `Z = 0.55` so Sarah's forearms rest naturally on it.
  - Refine wood texture to light warm oak grain matching reference.
  - Add subtle edge bevel / chamfer.

- [ ] **Step 3: Refine camera composition and lighting**
  - Set camera to frame head, high ponytail, shoulders, arms, hands, and desk naturally (matching `sarah-clean.png`).
  - Set soft key, fill, and rim lights to enhance facial features, eye reflections, and lipstick clarity.

---

### Task 6: Natural Seated Arm & Hand Pose (Curled Fingers Resting on Desk) & Conversational Gestures

**Files:**
- Modify: `frontend/src/lib/avatar/Local3DAvatarProvider.ts`

**Interfaces:**
- Produces:
  - Resting pose: forearms supported on desk, wrists relaxed, hands resting together near desk center with naturally curled fingers (no splayed claws, no floating limbs);
  - Speaking gestures: subtle controlled lift of one or both hands, returning smoothly to desk;
  - Listening pose: hands grounded on desk, occasional tiny posture adjustment.

- [ ] **Step 1: Implement finger curl and natural resting pose**
  - Identify finger bones in armature (`finger1_1_l`, `finger2_1_l`, etc.) or rotate wrist/hand to natural angle.
  - Position forearms and hands directly on the desk surface (`Y ~ -0.22`).

- [ ] **Step 2: Refine conversational gestures**
  - Ensure all gestures start from and return smoothly to the desk resting position.
  - Add smooth return interpolation to prevent sudden snaps.

---

### Task 7: Strict Audio Lip-Sync Gating & Candidate Microphone Isolation

**Files:**
- Modify: `frontend/src/lib/avatar/Local3DAvatarProvider.ts`
- Modify: `frontend/src/app/interview/[sessionId]/page.tsx`

**Interfaces:**
- Ensures:
  - Sarah speaks -> candidate STT immediately stopped;
  - Audio clock drives visemes;
  - Audio ends -> visemes reset to neutral (`sil_00`);
  - 350ms acoustic transition delay before candidate mic re-opens;
  - Candidate speaks -> STT captures candidate voice only; Sarah's mouth is completely motionless.

- [ ] **Step 1: Verify audio-driven mouth gating in `Local3DAvatarProvider.ts`**
  - Confirm `updateLipSync()` forces `sil_00 = 1.0` and all other visemes to `0` when `!this.isSpeakingActive`.

- [ ] **Step 2: Verify speaker ownership in `page.tsx`**
  - Ensure `speakInterviewerMessage()` stops STT before speaking.
  - Ensure candidate microphone is active only in `listening` state.

---

### Task 8: End-to-End Browser Testing, Multi-Angle Screenshot Capture & Verification

**Files:**
- Create/Modify: `scratch/browser_sarah_e2e_suite.py`
- Test: Next.js frontend dev server (`localhost:3000`)

**Interfaces:**
- Produces: 5 verification screenshots in `scratch/browser_screenshots`:
  1. `1_sarah_idle_seated.png`: Resting naturally behind desk with curled hands on desk surface.
  2. `2_sarah_speaking.png`: Speaking with visible mouth movement and visemes.
  3. `3_sarah_listening.png`: Listening attentively with warm calm eyes and rested hands.
  4. `4_sarah_smiling_nodding.png`: Warm smile and encouraging nod.
  5. `5_sarah_hand_gesture.png`: Subtle, natural hand gesture returning to desk.

- [ ] **Step 1: Start Next.js dev server and verify build without TypeScript or lint errors**
  - Run `npm run build` or start dev server.

- [ ] **Step 2: Execute CDP E2E test suite in Chrome**
  - Capture all 5 screenshots and measure FPS.

- [ ] **Step 3: Compare screenshots side-by-side with `sarah-clean.png`**
  - Check face, hair (no bangs, high ponytail), eyebrows, lipstick, eyes, body, shoulders, hands, desk.

- [ ] **Step 4: Report comprehensive final results**
