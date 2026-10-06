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
  // Bilabial consonants (lips completely sealed)
  { regex: /^[mbp]/i, viseme: "mbp", durationMs: 90, weight: 0.9 },
  // Labiodental consonants (lower lip against upper incisors)
  { regex: /^[fv]/i, viseme: "fv", durationMs: 100, weight: 0.75 },
  // Dental / Interdental
  { regex: /^th/i, viseme: "th", durationMs: 110, weight: 0.8 },
  // Sibilants
  { regex: /^[sz]/i, viseme: "sz", durationMs: 100, weight: 0.6 },
  { regex: /^(sh|ch|jh)/i, viseme: "sh", durationMs: 120, weight: 0.85 },
  // Velars
  { regex: /^[kg]/i, viseme: "kg", durationMs: 80, weight: 0.6 },
  // Vowels
  { regex: /^(oo|u|w)/i, viseme: "ou", durationMs: 140, weight: 0.95 },
  { regex: /^(o|oa|aw|au)/i, viseme: "oh", durationMs: 130, weight: 0.9 },
  { regex: /^(ee|ea|y)/i, viseme: "ee", durationMs: 130, weight: 0.85 },
  { regex: /^(a|ah|ai)/i, viseme: "aa", durationMs: 150, weight: 1.0 },
  { regex: /^(i|e)/i, viseme: "ih", durationMs: 110, weight: 0.75 },
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
   * Parse text into phonetic visemes with realistic conversational timing.
   * If targetDurationSec is supplied, scales timings to match actual audio duration.
   */
  public queueSpeechText(text: string, targetDurationSec?: number) {
    this.clear();
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      let i = 0;
      while (i < word.length) {
        let matched = false;
        const slice = word.slice(i, i + 3);

        for (const rule of PHONETIC_RULES) {
          if (rule.regex.test(slice)) {
            this.queue.push({
              viseme: rule.viseme,
              durationMs: rule.durationMs,
              weight: rule.weight,
            });
            i += slice.length > 1 && rule.regex.test(slice.slice(0, 2)) ? 2 : 1;
            matched = true;
            break;
          }
        }

        if (!matched) {
          const char = word[i];
          if ("aeiou".includes(char)) {
            this.queue.push({ viseme: "aa", durationMs: 110, weight: 0.7 });
          } else {
            this.queue.push({ viseme: "ih", durationMs: 80, weight: 0.5 });
          }
          i++;
        }
      }

      // Natural micro-pause between spoken words
      this.queue.push({ viseme: "sil", durationMs: 35, weight: 0.0 });
    }

    // Trailing closure
    this.queue.push({ viseme: "sil", durationMs: 150, weight: 0.0 });

    // Time-stretch if actual audio duration is known
    if (targetDurationSec && targetDurationSec > 0 && this.queue.length > 0) {
      const totalRawMs = this.queue.reduce((acc, item) => acc + item.durationMs, 0);
      const targetMs = targetDurationSec * 1000;
      const scale = targetMs / Math.max(100, totalRawMs);

      for (const item of this.queue) {
        item.durationMs = Math.max(20, item.durationMs * scale);
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
    const lerpSpeed = 20.0;
    this.currentIntensity +=
      (this.targetIntensity - this.currentIntensity) * Math.min(1.0, deltaSeconds * lerpSpeed);
    return {
      viseme: this.currentViseme,
      intensity: this.currentIntensity,
    };
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
