import { ITextToSpeechProvider, TextToSpeechCallbacks } from "./types";

export class BrowserTextToSpeechProvider implements ITextToSpeechProvider {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private _isSpeaking: boolean = false;
  private resumeInterval: any = null;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer high-quality female English voice
    const femaleVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Female") ||
          v.name.includes("Zira") ||
          v.name.includes("Samantha") ||
          v.name.includes("Karen") ||
          v.name.includes("Victoria") ||
          v.name.includes("Google UK English Female") ||
          v.name.includes("Google US English") ||
          v.name.includes("Natural"))
    );

    const defaultEnVoice = voices.find((v) => v.lang.startsWith("en"));
    this.selectedVoice = femaleVoice || defaultEnVoice || voices[0];
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  speak(text: string, callbacks?: TextToSpeechCallbacks): void {
    if (!this.synth) {
      callbacks?.onEnd?.();
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    if (!text || text.trim().length === 0) {
      callbacks?.onEnd?.();
      return;
    }

    // If voices haven't loaded yet, try loading once more
    if (!this.selectedVoice) {
      this.loadVoices();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.05; // Slightly higher pitch for clear female persona

    utterance.onstart = () => {
      this._isSpeaking = true;
      callbacks?.onStart?.();
    };

    utterance.onboundary = (event) => {
      callbacks?.onBoundary?.(event.charIndex);
    };

    utterance.onend = () => {
      this.cleanup();
      callbacks?.onEnd?.();
    };

    utterance.onerror = (event) => {
      this.cleanup();
      // Ignore cancel / interrupted errors
      if (event.error !== "canceled" && event.error !== "interrupted") {
        callbacks?.onError?.(event);
      } else {
        callbacks?.onEnd?.();
      }
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);

    // Chrome workaround for long speech synthesis pausing
    this.resumeInterval = setInterval(() => {
      if (this.synth && this._isSpeaking) {
        this.synth.resume();
      }
    }, 10000);
  }

  stop(): void {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {
        // Ignore cancel error
      }
    }
    this.cleanup();
  }

  pause(): void {
    if (this.synth && this._isSpeaking) {
      try {
        this.synth.pause();
      } catch (e) {
        // Ignore pause error
      }
    }
  }

  resume(): void {
    if (this.synth) {
      try {
        this.synth.resume();
      } catch (e) {
        // Ignore resume error
      }
    }
  }

  isSpeaking(): boolean {
    return this._isSpeaking;
  }

  private cleanup(): void {
    this._isSpeaking = false;
    this.currentUtterance = null;
    if (this.resumeInterval) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
  }
}
