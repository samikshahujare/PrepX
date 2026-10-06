import { ISpeechToTextProvider, SpeechToTextCallbacks } from "./types";

export class BrowserSpeechToTextProvider implements ISpeechToTextProvider {
  private recognition: any = null;
  private _isListening: boolean = false;
  private callbacks: SpeechToTextCallbacks = {};
  private manualStop: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";

        this.recognition.onstart = () => {
          this._isListening = true;
          this.callbacks.onStateChange?.(true);
        };

        this.recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (interimTranscript && this.callbacks.onInterimResult) {
            this.callbacks.onInterimResult(interimTranscript);
          }
          if (finalTranscript && this.callbacks.onFinalResult) {
            this.callbacks.onFinalResult(finalTranscript);
          }
        };

        this.recognition.onerror = (event: any) => {
          // Ignore benign 'no-speech' or 'aborted' events
          if (event.error === "no-speech" || event.error === "aborted") {
            return;
          }
          this.callbacks.onError?.(event.error || "Speech recognition error");
        };

        this.recognition.onend = () => {
          if (!this.manualStop && this._isListening) {
            // Restart if dropped unexpectedly
            try {
              this.recognition.start();
              return;
            } catch (e) {
              // Ignore restart error
            }
          }
          this._isListening = false;
          this.callbacks.onStateChange?.(false);
        };
      }
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  startListening(callbacks: SpeechToTextCallbacks): void {
    this.callbacks = callbacks;
    this.manualStop = false;
    if (!this.recognition) {
      callbacks.onError?.("Web Speech API is not supported in this browser.");
      return;
    }
    try {
      this.recognition.start();
    } catch (e) {
      // If already started, ignore
    }
  }

  stopListening(): void {
    this.manualStop = true;
    this._isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore stop error
      }
    }
    this.callbacks.onStateChange?.(false);
  }

  isListening(): boolean {
    return this._isListening;
  }
}
