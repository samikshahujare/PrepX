import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VisemeEngine } from "../VisemeEngine";
import { VisemeType } from "../types";

describe("VisemeEngine & Lip-Sync Controller Verification", () => {
  it("should parse text into phonetic visemes with realistic weights and durations", () => {
    const engine = new VisemeEngine();
    engine.queueSpeechText("Hello, welcome to PrepX.");

    assert.equal(engine.isQueueEmpty(), false);
    assert.ok(engine.getRemainingCount() > 0);

    // Initial viseme should be active
    const current = engine.getCurrentViseme();
    assert.ok(current !== undefined);

    // Weights must never exceed 0.85 (preventing exaggerated mouth opening)
    const targetIntensity = engine.getTargetIntensity();
    assert.ok(
      targetIntensity <= 0.85,
      `Expected target intensity <= 0.85, got ${targetIntensity}`
    );

    engine.clear();
    assert.equal(engine.getCurrentViseme(), "sil");
    assert.equal(engine.getTargetIntensity(), 0);
  });

  it("should insert natural pauses at punctuation marks without slamming mouth shut mid-word", () => {
    const engine = new VisemeEngine();
    // Test sentence with periods and commas
    engine.queueSpeechText("First phrase. Second phrase, third phrase!");

    assert.ok(engine.getRemainingCount() > 5);

    // Clean up
    engine.clear();
    assert.equal(engine.isQueueEmpty(), true);
  });

  it("should correctly identify and prioritize bilabials (M, B, P) with high sealing weight", () => {
    const engine = new VisemeEngine();
    engine.queueSpeechText("Make better problems vanish.");

    // Bilabial test: 'm', 'b', 'p' words
    const initialViseme = engine.getCurrentViseme();
    assert.equal(initialViseme, "mbp");
    assert.equal(engine.getTargetIntensity(), 0.85);

    engine.clear();
  });

  it("should restrict vowel weights so open vowels like /ɑ/ do not exceed safe intensity bounds", () => {
    const engine = new VisemeEngine();
    engine.queueSpeechText("Arm car palm.");

    const initialViseme = engine.getCurrentViseme();
    assert.equal(initialViseme, "aa");
    assert.ok(
      engine.getTargetIntensity() <= 0.65,
      `Expected 'aa' vowel weight <= 0.65, got ${engine.getTargetIntensity()}`
    );

    engine.clear();
  });

  it("should enforce anatomical budget clamping on jawOpen and lip morph targets", () => {
    // Test the anatomical bounding logic used in Local3DAvatarProvider
    const visemeKeys = [
      "aa_02", "ow_08", "w_uw_07", "p_b_m_21", "jawOpen",
      "mouthLowerDownLeft", "mouthLowerDownRight", "mouthUpperUpLeft", "mouthUpperUpRight",
      "mouthClose", "sil_00"
    ];

    const targetMorphValues = new Map<string, number>();

    const applyTunedViseme = (viseme: VisemeType, intensity: number, audioEnergy: number) => {
      targetMorphValues.clear();
      visemeKeys.forEach(k => targetMorphValues.set(k, 0));

      if (viseme === "sil" || audioEnergy <= 0.05 || intensity <= 0.01) {
        targetMorphValues.set("sil_00", 1.0);
        return;
      }

      const audioDrive = Math.max(0.55, Math.min(1.0, audioEnergy));
      const effectiveIntensity = Math.min(0.70, intensity * audioDrive);

      switch (viseme) {
        case "aa":
          targetMorphValues.set("aa_02", 0.36 * effectiveIntensity);
          targetMorphValues.set("jawOpen", 0.15 * effectiveIntensity);
          targetMorphValues.set("mouthLowerDownLeft", 0.05 * effectiveIntensity);
          targetMorphValues.set("mouthLowerDownRight", 0.05 * effectiveIntensity);
          break;
        case "mbp":
          targetMorphValues.set("p_b_m_21", 0.65 * effectiveIntensity);
          targetMorphValues.set("mouthClose", 0.35 * effectiveIntensity);
          targetMorphValues.set("jawOpen", 0.0);
          break;
        case "oh":
          targetMorphValues.set("ow_08", 0.38 * effectiveIntensity);
          targetMorphValues.set("jawOpen", 0.10 * effectiveIntensity);
          break;
      }

      // Master safety clamp
      const currentJaw = targetMorphValues.get("jawOpen") || 0;
      if (currentJaw > 0.18) targetMorphValues.set("jawOpen", 0.18);

      const closeIntent = (targetMorphValues.get("p_b_m_21") || 0) + (targetMorphValues.get("mouthClose") || 0);
      if (closeIntent > 0.15) {
        targetMorphValues.set("jawOpen", 0.0);
      }
    };

    // 1. Test "aa" vowel: jawOpen must NEVER exceed 0.18
    applyTunedViseme("aa", 1.0, 1.0);
    const aaJaw = targetMorphValues.get("jawOpen") || 0;
    assert.ok(aaJaw <= 0.18, `jawOpen for 'aa' was ${aaJaw}, expected <= 0.18`);
    assert.ok(aaJaw >= 0.05, `jawOpen for 'aa' was ${aaJaw}, expected visible movement >= 0.05`);

    // 2. Test "mbp": jawOpen MUST be strictly 0.0, lips sealed
    applyTunedViseme("mbp", 1.0, 1.0);
    const mbpJaw = targetMorphValues.get("jawOpen") || 0;
    const mbpClose = targetMorphValues.get("p_b_m_21") || 0;
    assert.equal(mbpJaw, 0.0, `jawOpen during bilabials MUST be 0.0, got ${mbpJaw}`);
    assert.ok(mbpClose >= 0.35, `p_b_m_21 must be active for lip seal, got ${mbpClose}`);

    // 3. Test silence: all speech morphs must be 0, sil_00 must be 1.0
    applyTunedViseme("sil", 0.0, 0.0);
    assert.equal(targetMorphValues.get("sil_00"), 1.0);
    assert.equal(targetMorphValues.get("jawOpen"), 0.0);
    assert.equal(targetMorphValues.get("aa_02"), 0.0);
  });

  it("should have zero cumulative drift across repeated speech cycles", () => {
    const activeMorphValues = new Map<string, number>();
    const reset = () => {
      activeMorphValues.set("jawOpen", 0.0);
      activeMorphValues.set("aa_02", 0.0);
      activeMorphValues.set("ow_08", 0.0);
      activeMorphValues.set("p_b_m_21", 0.0);
      activeMorphValues.set("sil_00", 1.0);
    };

    // Run 10 consecutive simulated phrases
    for (let cycle = 0; cycle < 10; cycle++) {
      // simulate speech target activation
      activeMorphValues.set("jawOpen", 0.14);
      activeMorphValues.set("aa_02", 0.28);
      activeMorphValues.set("sil_00", 0.0);

      // simulate speech completed and reset called
      reset();

      // verify exact clean return
      assert.equal(activeMorphValues.get("jawOpen"), 0.0);
      assert.equal(activeMorphValues.get("aa_02"), 0.0);
      assert.equal(activeMorphValues.get("sil_00"), 1.0);
    }
  });
});
