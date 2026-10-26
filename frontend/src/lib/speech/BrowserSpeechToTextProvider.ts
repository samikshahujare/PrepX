import { ISpeechToTextProvider, SpeechToTextCallbacks } from "./types";

export type STTMicrophoneStatus =
  | "unsupported"
  | "permission_prompt"
  | "permission_denied"
  | "no_microphone"
  | "listening"
  | "muted"
  | "paused_for_moderator"
  | "error";

export interface ExtendedSpeechToTextCallbacks extends SpeechToTextCallbacks {
  onStatusChange?: (status: STTMicrophoneStatus, details?: string) => void;
}

export class BrowserSpeechToTextProvider implements ISpeechToTextProvider {
  private recognition: any = null;
  private _isListening: boolean = false;
  private callbacks: ExtendedSpeechToTextCallbacks = {};
  private manualStop: boolean = true;
  private isMuted: boolean = false;
  private pausedForModerator: boolean = false;
  private currentEpoch: number = 0;
  private restartTimeout: NodeJS.Timeout | null = null;
  private consecutiveErrors: number = 0;
  private lastActiveTimestamp: number = 0;

  constructor() {}

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.callbacks.onStatusChange?.("muted");
    } else {
      if (this._isListening) {
        this.callbacks.onStatusChange?.("listening");
      } else if (!this.manualStop) {
        this.startRecognitionInstance();
      }
    }
  }

  setModeratorSpeaking(isSpeaking: boolean): void {
    this.pausedForModerator = isSpeaking;
    if (isSpeaking) {
      if (!this.isMuted && this._isListening) {
        this.callbacks.onStatusChange?.("paused_for_moderator");
      }
    } else {
      if (!this.isMuted && this._isListening) {
        this.callbacks.onStatusChange?.("listening");
      }
    }
  }

  startListening(callbacks: ExtendedSpeechToTextCallbacks): void {
    if (typeof window === "undefined") return;

    this.stopListening();

    if (!this.isSupported()) {
      callbacks.onStatusChange?.("unsupported", "Web Speech API is not supported in this browser.");
      callbacks.onError?.(
        "Web Speech API is not supported in this browser. Please use Chrome or Edge for automated speech-to-text, or type in the text box."
      );
      return;
    }

    this.callbacks = callbacks;
    this.manualStop = false;
    this.consecutiveErrors = 0;
    this.currentEpoch++;

    this.startRecognitionInstance();
  }

  private startRecognitionInstance(): void {
    if (this.manualStop) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    const thisEpoch = this.currentEpoch;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) {
          try {
            recognition.abort();
          } catch (_) {}
          return;
        }
        this._isListening = true;
        this.consecutiveErrors = 0;
        this.lastActiveTimestamp = Date.now();
        this.callbacks.onStateChange?.(true);
        if (this.isMuted) {
          this.callbacks.onStatusChange?.("muted");
        } else if (this.pausedForModerator) {
          this.callbacks.onStatusChange?.("paused_for_moderator");
        } else {
          this.callbacks.onStatusChange?.("listening");
        }
      };

      recognition.onspeechstart = () => {
        if (thisEpoch !== this.currentEpoch || this.manualStop || this.isMuted) return;
        this.callbacks.onSpeechStart?.();
      };

      recognition.onspeechend = () => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) return;
        this.callbacks.onSpeechEnd?.();
      };

      recognition.onresult = (event: any) => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) return;
        if (this.isMuted || this.pausedForModerator) return;

        this.lastActiveTimestamp = Date.now();

        let newFinalTranscript = "";
        let newInterimTranscript = "";

        // Standard delta processing: iterate only from event.resultIndex forward
        // to prevent cumulative multi-turn duplication in continuous mode
        const startIndex = typeof event.resultIndex === "number" ? event.resultIndex : 0;
        for (let i = startIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            newFinalTranscript += (newFinalTranscript ? " " : "") + text.trim();
          } else {
            newInterimTranscript += (newInterimTranscript ? " " : "") + text.trim();
          }
        }

        newFinalTranscript = newFinalTranscript.replace(/\s+/g, " ").trim();
        newInterimTranscript = newInterimTranscript.replace(/\s+/g, " ").trim();

        if (newInterimTranscript && this.callbacks.onInterimResult) {
          this.callbacks.onInterimResult(newInterimTranscript);
        }
        if (newFinalTranscript && this.callbacks.onFinalResult) {
          this.callbacks.onFinalResult(newFinalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) return;

        const error = event.error;

        // "no-speech" is normal in continuous listening during silence pauses
        if (error === "no-speech") {
          return;
        }

        // "aborted" is expected during manual stops or restart cycles
        if (error === "aborted") {
          return;
        }

        console.warn("[BrowserSpeechToTextProvider] STT error event:", error);
        this.consecutiveErrors++;

        if (error === "not-allowed" || error === "service-not-allowed") {
          this.manualStop = true;
          this.callbacks.onStatusChange?.("permission_denied", "Microphone access was denied in browser permissions.");
          this.callbacks.onError?.(
            "Microphone access blocked. Please click the camera/mic icon in your browser address bar to allow microphone permissions, or type below."
          );
        } else if (error === "audio-capture") {
          this.manualStop = true;
          this.callbacks.onStatusChange?.("no_microphone", "No audio input hardware detected.");
          this.callbacks.onError?.(
            "No microphone detected. Please plug in or enable an audio input device."
          );
        } else if (error === "network") {
          this.callbacks.onStatusChange?.("error", "Speech recognition network error.");
          this.callbacks.onError?.(
            "Speech recognition network timeout. Reconnecting..."
          );
          this.scheduleRestart(1000);
        } else {
          this.callbacks.onStatusChange?.("error", error);
          this.callbacks.onError?.(
            `Speech recognition notice: ${error || "Unknown"}`
          );
        }
      };

      recognition.onend = () => {
        if (thisEpoch !== this.currentEpoch) return;

        this._isListening = false;
        this.recognition = null;

        // In Chrome, webkitSpeechRecognition continuously terminates on silence even with continuous: true.
        // If not manually stopped, automatically re-arm to maintain continuous room transcription.
        if (!this.manualStop) {
          const delay = this.consecutiveErrors > 3 ? 1500 : 150;
          this.scheduleRestart(delay);
        } else {
          this.callbacks.onSpeechEnd?.();
          this.callbacks.onStateChange?.(false);
          this.callbacks.onStatusChange?.("muted");
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn("[BrowserSpeechToTextProvider] Start failed:", err);
      if (!this.manualStop) {
        this.scheduleRestart(800);
      }
    }
  }

  private scheduleRestart(delayMs: number): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    if (this.manualStop) return;

    this.restartTimeout = setTimeout(() => {
      this.restartTimeout = null;
      if (!this.manualStop) {
        this.startRecognitionInstance();
      }
    }, delayMs);
  }

  stopListening(): void {
    this.currentEpoch++;
    this.manualStop = true;
    this._isListening = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.onspeechstart = null;
        rec.onspeechend = null;
        rec.abort();
      } catch (_) {}
    }

    const oldCb = this.callbacks;
    this.callbacks = {};
    oldCb.onStateChange?.(false);
    oldCb.onStatusChange?.("muted");
  }

  isListening(): boolean {
    return this._isListening && !this.manualStop && !this.isMuted;
  }
}
