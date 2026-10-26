import { VisemeType } from "./types";

/**
 * Phonetic viseme mapping rule dictionary
 */
interface PhonemeMapping {
  regex: RegExp;
  viseme: VisemeType;
  durationMs: number;
  weight: number;
}

const PHONETIC_RULES: PhonemeMapping[] = [
  // Bilabial consonants (lips completely sealed: M, B, P)
  { regex: /^[mbp]/i, viseme: "mbp", durationMs: 85, weight: 0.85 },
  // Labiodental consonants (lower lip against upper incisors: F, V)
  { regex: /^[fv]/i, viseme: "fv", durationMs: 90, weight: 0.65 },
  // Dental / Interdental: TH
  { regex: /^th/i, viseme: "th", durationMs: 95, weight: 0.60 },
  // Sibilants: S, Z
  { regex: /^[sz]/i, viseme: "sz", durationMs: 85, weight: 0.50 },
  // Affricates / Palato-alveolars: SH, CH, J
  { regex: /^(sh|ch|jh)/i, viseme: "sh", durationMs: 100, weight: 0.60 },
  // Velars: K, G, NG
  { regex: /^[kg]/i, viseme: "kg", durationMs: 75, weight: 0.45 },
  // Close rounded vowels / semi-vowels: YOU, OO, U, W
  { regex: /^(you|oo|u|w)/i, viseme: "ou", durationMs: 120, weight: 0.65 },
  // Mid rounded vowels: O, OA, AW, AU
  { regex: /^(o|oa|aw|au)/i, viseme: "oh", durationMs: 115, weight: 0.60 },
  // High-front spread vowels: EE, EA, Y
  { regex: /^(ee|ea|y)/i, viseme: "ee", durationMs: 110, weight: 0.55 },
  // Open vowels: A, AH, AI
  { regex: /^(a|ah|ai)/i, viseme: "aa", durationMs: 125, weight: 0.65 },
  // Mid-front lax vowels: I, E
  { regex: /^(i|e)/i, viseme: "ih", durationMs: 95, weight: 0.50 },
];

export class VisemeEngine {
  private currentViseme: VisemeType = "sil";
  private currentIntensity: number = 0;
  private targetIntensity: number = 0;
  private queue: { viseme: VisemeType; durationMs: number; weight: number }[] = [];
  private isProcessing: boolean = false;
  private timer: any = null;
  private onVisemeUpdate?: (viseme: VisemeType, intensity: number) => void;

  constructor(onVisemeUpdate?: (viseme: VisemeType, intensity: number) => void) {
    this.onVisemeUpdate = onVisemeUpdate;
  }

  public setListener(onVisemeUpdate: (viseme: VisemeType, intensity: number) => void) {
    this.onVisemeUpdate = onVisemeUpdate;
  }

  /**
   * Parse text into phonetic visemes with realistic conversational timing and coarticulation.
   * If targetDurationSec is supplied, scales timings to match actual audio duration.
   */
  public queueSpeechText(text: string, targetDurationSec?: number) {
    this.clear();

    if (!text || !text.trim()) {
      return;
    }

    // Preserve punctuation for natural conversational pauses
    // Tokenize into words and punctuation marks
    const tokens = text.match(/[\w']+|[.,!?;:]/g) || [];

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];

      // Handle natural punctuation pauses
      if (token === "." || token === "!" || token === "?") {
        this.queue.push({ viseme: "sil", durationMs: 220, weight: 0.0 });
        continue;
      }
      if (token === "," || token === ";" || token === ":") {
        this.queue.push({ viseme: "sil", durationMs: 130, weight: 0.0 });
        continue;
      }

      const word = token.toLowerCase();
      let i = 0;
      while (i < word.length) {
        let matched = false;
        const remaining = word.slice(i);

        for (const rule of PHONETIC_RULES) {
          const match = rule.regex.exec(remaining);
          if (match) {
            this.queue.push({
              viseme: rule.viseme,
              durationMs: rule.durationMs,
              weight: rule.weight,
            });
            i += Math.max(1, match[0].length);
            matched = true;
            break;
          }
        }

        if (!matched) {
          const char = word[i];
          if ("aeiou".includes(char)) {
            this.queue.push({ viseme: "aa", durationMs: 95, weight: 0.55 });
          } else {
            this.queue.push({ viseme: "ih", durationMs: 75, weight: 0.40 });
          }
          i++;
        }
      }

      // Natural subtle coarticulation transition between spoken words
      // Avoids slamming completely shut to 0 for a jarring single frame
      this.queue.push({ viseme: "sil", durationMs: 40, weight: 0.06 });
    }

    // Trailing closure when speech is done
    this.queue.push({ viseme: "sil", durationMs: 200, weight: 0.0 });

    // Time-stretch if actual audio duration is known
    if (targetDurationSec && targetDurationSec > 0 && this.queue.length > 0) {
      const totalRawMs = this.queue.reduce((acc, item) => acc + item.durationMs, 0);
      const targetMs = targetDurationSec * 1000;
      const scale = targetMs / Math.max(100, totalRawMs);

      for (const item of this.queue) {
        item.durationMs = Math.max(25, item.durationMs * scale);
      }
    }

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.currentViseme = "sil";
      this.targetIntensity = 0;
      this.onVisemeUpdate?.("sil", 0);
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift()!;
    this.currentViseme = item.viseme;
    this.targetIntensity = item.weight;

    this.onVisemeUpdate?.(this.currentViseme, this.targetIntensity);

    this.timer = setTimeout(() => {
      this.processQueue();
    }, item.durationMs);
  }

  /**
   * Smoothly interpolate current intensity towards target
   */
  public update(deltaSeconds: number): { viseme: VisemeType; intensity: number } {
    const lerpSpeed = 16.0;
    this.currentIntensity +=
      (this.targetIntensity - this.currentIntensity) * Math.min(1.0, deltaSeconds * lerpSpeed);
    return {
      viseme: this.currentViseme,
      intensity: this.currentIntensity,
    };
  }

  public isQueueEmpty(): boolean {
    return this.queue.length === 0;
  }

  public getRemainingCount(): number {
    return this.queue.length;
  }

  public getCurrentViseme(): VisemeType {
    return this.currentViseme;
  }

  public getTargetIntensity(): number {
    return this.targetIntensity;
  }

  public clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
    this.isProcessing = false;
    this.currentViseme = "sil";
    this.currentIntensity = 0;
    this.targetIntensity = 0;
    this.onVisemeUpdate?.("sil", 0);
  }
}

