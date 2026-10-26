/**
 * AvatarEngine for PrepX
 * Unified interface orchestrating local 2D/Canvas AI Interviewer avatar,
 * development fallback, and testing mocks.
 * 
 * Local Architecture:
 * AvatarEngine
 * │
 * ├── LocalSarah2DAvatarProvider  (Primary: In-Browser 2D/Canvas AI Interviewer)
 * ├── Local3DAvatarProvider       (Development Fallback: Procedural 3D WebGL)
 * └── MockAvatarProvider          (Automated Testing & Headless CI)
 * 
 * PrepX interacts strictly with AvatarEngine.
 */

import {
  IAvatarProvider,
  AvatarState,
  ExpressionState,
  GestureType,
  VisemeType,
  AvatarProviderType,
  AvatarInitResult,
  ExternalProviderConfig,
} from "./types";
import { LocalSarah2DAvatarProvider } from "./LocalSarah2DAvatarProvider";
import { Local3DAvatarProvider } from "./Local3DAvatarProvider";
import { MockAvatarProvider } from "./MockAvatarProvider";

export class AvatarEngine {
  private static sessionInstances: Map<string, AvatarEngine> = new Map();

  /**
   * Access or create a stable session-scoped AvatarEngine.
   */
  public static getSessionEngine(
    sessionId: string = "default",
    defaultProviderType: AvatarProviderType = "local_3d"
  ): AvatarEngine {
    if (!AvatarEngine.sessionInstances.has(sessionId)) {
      AvatarEngine.sessionInstances.set(sessionId, new AvatarEngine(defaultProviderType));
    }
    return AvatarEngine.sessionInstances.get(sessionId)!;
  }

  /**
   * Explicitly destroy the session-scoped AvatarEngine when interview session finishes.
   */
  public static destroySessionEngine(sessionId: string = "default"): void {
    if (AvatarEngine.sessionInstances.has(sessionId)) {
      const engine = AvatarEngine.sessionInstances.get(sessionId);
      engine?.dispose();
      AvatarEngine.sessionInstances.delete(sessionId);
    }
  }

  private activeProvider: IAvatarProvider | null = null;
  private providerType: AvatarProviderType = "local_3d";
  private container: HTMLElement | null = null;
  private canvasOrVideo: HTMLElement | null = null;
  private currentState: AvatarState = "IDLE";
  private thinkingTimer: any = null;
  private isFallbackActive: boolean = false;
  private lastInitResult: AvatarInitResult | null = null;
  private externalConfig?: ExternalProviderConfig;
  private stateCallbacks: Set<(state: AvatarState) => void> = new Set();
  private readyCallbacks: Set<() => void> = new Set();

  constructor(defaultProviderType: AvatarProviderType = "local_3d") {
    this.providerType = defaultProviderType;
  }

  public attachMount(container: HTMLElement, canvasOrVideo?: HTMLElement): void {
    this.container = container;
    this.canvasOrVideo = canvasOrVideo || null;
    if (this.activeProvider && typeof (this.activeProvider as any).attachMount === "function") {
      (this.activeProvider as any).attachMount(container, canvasOrVideo);
    }
  }

  private initPromise: Promise<AvatarInitResult> | null = null;

  public async initialize(
    container: HTMLElement,
    canvasOrVideo?: HTMLElement,
    externalConfig?: ExternalProviderConfig
  ): Promise<AvatarInitResult> {
    this.container = container;
    this.canvasOrVideo = canvasOrVideo || null;
    this.externalConfig = externalConfig;

    if (this.initPromise) {
      this.attachMount(container, canvasOrVideo);
      return this.initPromise;
    }

    if (
      this.activeProvider &&
      (this.activeProvider.isReady() || this.lastInitResult?.success) &&
      this.activeProvider.getProviderType() === this.providerType
    ) {
      this.attachMount(container, canvasOrVideo);
      return this.lastInitResult || {
        success: true,
        providerType: this.providerType,
        providerName: this.activeProvider.getProviderName(),
        isFallback: false,
        status: "ready",
        message: "Active local avatar session preserved",
      };
    }

    this.initPromise = (async () => {
      try {
        if (this.activeProvider) {
          this.activeProvider.dispose();
          this.activeProvider = null;
        }

        if (this.providerType === "local_2d" || this.providerType === "neural") {
          this.activeProvider = new LocalSarah2DAvatarProvider(this.externalConfig);
        } else if (this.providerType === "local_3d") {
          this.activeProvider = new Local3DAvatarProvider();
        } else {
          this.activeProvider = new MockAvatarProvider();
        }

        const initResult = await this.activeProvider.initialize(container, this.canvasOrVideo || undefined);
        this.lastInitResult = initResult;
        this.isFallbackActive = initResult.isFallback;

        if (this.activeProvider && typeof (this.activeProvider as any).onStateChange === "function") {
          (this.activeProvider as any).onStateChange((state: AvatarState) => {
            this.currentState = state;
            this.stateCallbacks.forEach((cb) => {
              try {
                cb(state);
              } catch (_) {}
            });
          });
        }

        if (this.activeProvider && typeof (this.activeProvider as any).onReady === "function") {
          (this.activeProvider as any).onReady(() => {
            this.readyCallbacks.forEach((cb) => {
              try {
                cb();
              } catch (_) {}
            });
          });
        }

        return initResult;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public async switchProvider(
    newType: AvatarProviderType,
    externalConfig?: ExternalProviderConfig
  ): Promise<AvatarInitResult | null> {
    if (this.activeProvider) {
      this.activeProvider.dispose();
      this.activeProvider = null;
    }

    this.providerType = newType;
    if (externalConfig) {
      this.externalConfig = externalConfig;
    }

    if (this.container) {
      const res = await this.initialize(this.container, this.canvasOrVideo || undefined, this.externalConfig);
      this.setState(this.currentState);
      return res;
    }
    return null;
  }

  public getProviderType(): AvatarProviderType {
    return this.providerType;
  }

  public getProviderName(): string {
    return this.activeProvider ? this.activeProvider.getProviderName() : "Sarah — Local 2D AI Interviewer";
  }

  public isFallback(): boolean {
    return this.isFallbackActive || (this.activeProvider ? this.activeProvider.isFallback() : false);
  }

  public isReady(): boolean {
    return this.activeProvider ? this.activeProvider.isReady() : false;
  }

  public getStatusMessage(): string {
    return this.activeProvider ? this.activeProvider.getStatusMessage() : "Sarah — Local AI Interviewer Ready";
  }

  public onReady(callback: () => void): void {
    this.readyCallbacks.add(callback);
    if (this.isReady()) {
      try {
        callback();
      } catch (_) {}
    }
  }

  public onStateChange(callback: (state: AvatarState) => void): void {
    this.stateCallbacks.add(callback);
    if (this.currentState) {
      try {
        callback(this.currentState);
      } catch (_) {}
    }
  }

  public getLastInitResult(): AvatarInitResult | null {
    return this.lastInitResult;
  }

  public getCurrentState(): AvatarState {
    return this.currentState;
  }

  /**
   * Set semantic avatar state with automatic conversational timing
   */
  public setState(state: AvatarState): void {
    if (this.thinkingTimer) {
      clearTimeout(this.thinkingTimer);
      this.thinkingTimer = null;
    }

    this.currentState = state;
    if (this.activeProvider) {
      this.activeProvider.setState(state);
    }
    this.stateCallbacks.forEach((cb) => {
      try {
        cb(state);
      } catch (_) {}
    });
  }

  /**
   * Initiate conversational thinking phase before speaking
   */
  public enterThinkingPhase(onReadyToSpeak: () => void, delayMs: number = 800): void {
    this.setState("THINKING");

    this.thinkingTimer = setTimeout(() => {
      this.thinkingTimer = null;
      onReadyToSpeak();
    }, delayMs);
  }

  public setExpression(expression: ExpressionState, weight?: number): void {
    if (this.activeProvider) {
      this.activeProvider.setExpression(expression, weight);
    }
  }

  public triggerGesture(gesture: GestureType): void {
    if (this.activeProvider) {
      this.activeProvider.triggerGesture(gesture);
    }
  }

  public onCandidateGaveStrongAnswer(): void {
    if (this.activeProvider && typeof (this.activeProvider as any).onCandidateGaveStrongAnswer === "function") {
      (this.activeProvider as any).onCandidateGaveStrongAnswer();
    } else {
      this.setExpression("WARM_SMILE", 1.0);
      this.triggerGesture("NOD_ENCOURAGING");
    }
  }

  public onCandidateGaveWeakAnswer(): void {
    if (this.activeProvider && typeof (this.activeProvider as any).onCandidateGaveWeakAnswer === "function") {
      (this.activeProvider as any).onCandidateGaveWeakAnswer();
    } else {
      this.setExpression("CONCERNED", 1.0);
    }
  }

  public setViseme(viseme: VisemeType, intensity: number): void {
    if (this.activeProvider) {
      this.activeProvider.setViseme(viseme, intensity);
    }
  }

  public onCandidateAudioLevel(level: number): void {
    if (this.activeProvider) {
      this.activeProvider.onCandidateAudioLevel(level);
    }
  }

  public onCandidateGaze(normalizedX: number, normalizedY: number): void {
    if (this.activeProvider) {
      this.activeProvider.onCandidateGaze(normalizedX, normalizedY);
    }
  }

  public speak(text: string, onEnd?: () => void): void {
    if (this.activeProvider) {
      this.activeProvider.speak(text, () => {
        this.setState("LISTENING");
        onEnd?.();
      });
    } else {
      onEnd?.();
    }
  }

  public stopSpeaking(): void {
    if (this.activeProvider) {
      this.activeProvider.stopSpeaking();
    }
  }

  public setLipSyncTuningMode(mode: "tuned" | "exaggerated"): void {
    if (this.activeProvider && typeof (this.activeProvider as any).setLipSyncTuningMode === "function") {
      (this.activeProvider as any).setLipSyncTuningMode(mode);
    }
  }

  public getLipSyncDiagnostics(): any {
    if (this.activeProvider && typeof (this.activeProvider as any).getLipSyncDiagnostics === "function") {
      return (this.activeProvider as any).getLipSyncDiagnostics();
    }
    return null;
  }

  public resize(width: number, height: number): void {
    if (this.activeProvider) {
      this.activeProvider.resize(width, height);
    }
  }

  public dispose(): void {
    this.initPromise = null;
    if (this.thinkingTimer) {
      clearTimeout(this.thinkingTimer);
      this.thinkingTimer = null;
    }
    if (this.activeProvider) {
      this.activeProvider.dispose();
      this.activeProvider = null;
    }
  }
}
