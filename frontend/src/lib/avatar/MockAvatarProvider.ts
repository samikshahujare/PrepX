/**
 * MockAvatarProvider for PrepX Automated Testing
 * Headless provider with zero external dependencies and deterministic state transitions.
 */

import {
  IAvatarProvider,
  AvatarState,
  ExpressionState,
  GestureType,
  VisemeType,
  AvatarProviderType,
  AvatarInitResult,
} from "./types";

export class MockAvatarProvider implements IAvatarProvider {
  private currentState: AvatarState = "IDLE";
  private currentExpression: ExpressionState = "NEUTRAL";
  private isSpeakingActive: boolean = false;
  private speakTimeout: any = null;

  public getProviderName(): string {
    return "Mock Avatar Engine (Automated Testing)";
  }

  public getProviderType(): AvatarProviderType {
    return "mock";
  }

  public isFallback(): boolean {
    return false;
  }

  public isReady(): boolean {
    return true;
  }

  public getStatusMessage(): string {
    return "Mock provider active for headless testing.";
  }

  public async initialize(_container: HTMLElement, _videoOrCanvas?: HTMLElement): Promise<AvatarInitResult> {
    return {
      success: true,
      providerType: "mock",
      providerName: this.getProviderName(),
      isFallback: false,
      status: "ready",
      message: "Mock avatar provider initialized successfully.",
    };
  }

  public setState(state: AvatarState): void {
    this.currentState = state;
  }

  public getCurrentState(): AvatarState {
    return this.currentState;
  }

  public setExpression(expression: ExpressionState, _weight: number = 1.0): void {
    this.currentExpression = expression;
  }

  public getCurrentExpression(): ExpressionState {
    return this.currentExpression;
  }

  public triggerGesture(_gesture: GestureType): void {
    // Recorded for test verification
  }

  public setViseme(_viseme: VisemeType, _intensity: number): void {
    // Recorded for test verification
  }

  public onCandidateAudioLevel(_level: number): void {
    // Mock audio level tracking
  }

  public onCandidateGaze(_normalizedX: number, _normalizedY: number): void {
    // Mock gaze tracking
  }

  public speak(text: string, onEnd?: () => void): void {
    this.stopSpeaking();
    this.isSpeakingActive = true;
    this.currentState = "SPEAKING";

    // Deterministic short test delay
    const duration = Math.min(500, Math.max(100, text.length * 10));
    this.speakTimeout = setTimeout(() => {
      this.isSpeakingActive = false;
      this.currentState = "LISTENING";
      onEnd?.();
    }, duration);
  }

  public stopSpeaking(): void {
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }
    this.isSpeakingActive = false;
  }

  public resize(_width: number, _height: number): void {
    // No-op for headless mock
  }

  public dispose(): void {
    this.stopSpeaking();
  }
}
