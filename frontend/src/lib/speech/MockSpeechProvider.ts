import {
  ISpeechToTextProvider,
  ITextToSpeechProvider,
  SpeechToTextCallbacks,
  TextToSpeechCallbacks,
} from "./types";

export class MockSpeechToTextProvider implements ISpeechToTextProvider {
  private _isListening: boolean = false;
  private callbacks: SpeechToTextCallbacks = {};

  isSupported(): boolean {
    return true;
  }

  startListening(callbacks: SpeechToTextCallbacks): void {
    this._isListening = true;
    this.callbacks = callbacks;
    callbacks.onStateChange?.(true);
  }

  stopListening(): void {
    this._isListening = false;
    this.callbacks.onStateChange?.(false);
  }

  isListening(): boolean {
    return this._isListening;
  }

  simulateCandidateInput(text: string) {
    if (this._isListening && this.callbacks.onFinalResult) {
      this.callbacks.onFinalResult(text);
    }
  }
}

export class MockTextToSpeechProvider implements ITextToSpeechProvider {
  private _isSpeaking: boolean = false;
  private timeoutId: any = null;

  isSupported(): boolean {
    return true;
  }

  speak(text: string, callbacks?: TextToSpeechCallbacks): void {
    this.stop();
    this._isSpeaking = true;
    callbacks?.onStart?.();

    // Simulate reading duration based on word count
    const words = text.split(/\s+/).length;
    const durationMs = Math.min(Math.max(words * 220, 1500), 7000);

    this.timeoutId = setTimeout(() => {
      this._isSpeaking = false;
      callbacks?.onEnd?.();
    }, durationMs);
  }

  stop(): void {
    this._isSpeaking = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  pause(): void {
    this.stop();
  }

  resume(): void {}

  isSpeaking(): boolean {
    return this._isSpeaking;
  }
}
