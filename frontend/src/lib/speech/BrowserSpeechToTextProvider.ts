import { ISpeechToTextProvider, SpeechToTextCallbacks } from "./types";

export class BrowserSpeechToTextProvider implements ISpeechToTextProvider {
  private recognition: any = null;
  private _isListening: boolean = false;
  private callbacks: SpeechToTextCallbacks = {};
  private manualStop: boolean = true;
  private currentEpoch: number = 0;

  constructor() {}

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  startListening(callbacks: SpeechToTextCallbacks): void {
    if (typeof window === "undefined") return;

    // 1. Immediately abort and clean up any existing recognition session
    this.stopListening();

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      callbacks.onError?.(
        "Web Speech API is not supported in this browser. You can type your answers in the text box."
      );
      return;
    }

    this.currentEpoch++;
    const thisEpoch = this.currentEpoch;
    this.callbacks = callbacks;
    this.manualStop = false;
    this._isListening = false;

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
        this.callbacks.onStateChange?.(true);
      };

      recognition.onspeechstart = () => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) return;
        this.callbacks.onSpeechStart?.();
      };

      recognition.onspeechend = () => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) return;
        this.callbacks.onSpeechEnd?.();
      };

      recognition.onresult = (event: any) => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) return;

        let finalTranscript = "";
        let interimTranscript = "";

        // Loop across all results in this session to get accurate cumulative state
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            finalTranscript += (finalTranscript ? " " : "") + text.trim();
          } else {
            interimTranscript += (interimTranscript ? " " : "") + text.trim();
          }
        }

        finalTranscript = finalTranscript.replace(/\s+/g, " ").trim();
        interimTranscript = interimTranscript.replace(/\s+/g, " ").trim();

        if (interimTranscript && this.callbacks.onInterimResult) {
          this.callbacks.onInterimResult(interimTranscript);
        }
        if (finalTranscript && this.callbacks.onFinalResult) {
          this.callbacks.onFinalResult(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) return;

        const error = event.error;

        // Ignore benign events
        if (error === "no-speech" || error === "aborted") {
          return;
        }

        console.warn("[BrowserSpeechToTextProvider] STT notice:", error);

        if (error === "not-allowed" || error === "service-not-allowed") {
          this.callbacks.onError?.(
            "Microphone access blocked. Please allow microphone permissions or type your answer below."
          );
        } else if (error === "audio-capture") {
          this.callbacks.onError?.(
            "No microphone detected. Please plug in or enable a microphone."
          );
        } else if (error === "network") {
          this.callbacks.onError?.(
            "Speech recognition network error. Please check your connection or type your answer."
          );
        } else {
          this.callbacks.onError?.(
            `Speech recognition error: ${error || "Unknown"}`
          );
        }
      };

      recognition.onend = () => {
        if (thisEpoch !== this.currentEpoch || this.manualStop) {
          this._isListening = false;
          return;
        }

        this._isListening = false;
        this.callbacks.onSpeechEnd?.();
        this.callbacks.onStateChange?.(false);
      };

      this.recognition = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn("[BrowserSpeechToTextProvider] Failed to start:", err);
      callbacks.onError?.(
        `Unable to activate microphone recognition: ${err?.message || err}`
      );
    }
  }

  stopListening(): void {
    this.currentEpoch++;
    this.manualStop = true;
    this._isListening = false;

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
  }

  isListening(): boolean {
    return this._isListening && !this.manualStop;
  }
}
