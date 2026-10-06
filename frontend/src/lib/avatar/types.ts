/**
 * AvatarEngine Type Definitions for PrepX
 * Defines unified semantic avatar states, visemes, expressions, gestures, and provider abstractions.
 * 
 * Local Architecture:
 * AvatarEngine
 * │
 * ├── LocalSarah2DAvatarProvider  (Primary: Lightweight In-Browser 2D/Canvas AI Interviewer)
 * ├── Local3DAvatarProvider       (Development Fallback: Procedural 3D WebGL)
 * └── MockAvatarProvider          (Automated Testing / Headless CI)
 */

export type AvatarState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "SMILING"
  | "CONCERNED"
  | "ENCOURAGING"
  | "NODDING"
  | "PAUSED"
  | "COMPLETED"
  | "RECONNECTING";

export type VisemeType =
  | "sil"   // silence / rest
  | "aa"    // 'a' in father, car (wide open)
  | "ee"    // 'ee' in see, need (wide horizontal)
  | "ih"    // 'i' in bit, it
  | "oh"    // 'o' in go, boat (oval rounded)
  | "ou"    // 'oo' in too, shoe (pursed lips)
  | "mbp"   // m, b, p (lips closed)
  | "fv"    // f, v (bottom lip to top teeth)
  | "th"    // th (tongue between teeth)
  | "sz"    // s, z (teeth together)
  | "sh"    // sh, ch, j (lips rounded forward)
  | "kg"    // k, g, ng (jaw open, back tongue)
  | "rest";

export type ExpressionState =
  | "NEUTRAL"
  | "WARM_SMILE"
  | "LISTENING"
  | "INTERESTED"
  | "THINKING"
  | "ENCOURAGING"
  | "SURPRISED"
  | "CONCERNED"
  | "PROFESSIONAL_SERIOUS";

export type GestureType =
  | "RESTING_DESK"
  | "SPEAKING_EMPHASIS_LEFT"
  | "SPEAKING_EMPHASIS_RIGHT"
  | "EXPLAINING_OPEN_PALMS"
  | "NOD"
  | "NOD_ENCOURAGING"
  | "THINKING_TILT";

export type AvatarProviderType = "local_2d" | "neural" | "local_3d" | "mock";
export type LocalAvatarVendor = "local" | "canvas_2d";

export interface AvatarInitResult {
  success: boolean;
  providerType: AvatarProviderType;
  providerName: string;
  isFallback: boolean;
  status: "ready" | "unconfigured" | "connecting" | "error";
  message: string;
  avatarId?: string;
  targetPersona?: string;
  referenceImageUrl?: string;
  requiredEnvVars?: string[];
}

export interface IAvatarProvider {
  getProviderName(): string;
  getProviderType(): AvatarProviderType;
  isFallback(): boolean;
  isReady(): boolean;
  getStatusMessage(): string;
  initialize(container: HTMLElement, videoOrCanvas?: HTMLElement): Promise<AvatarInitResult>;
  setState(state: AvatarState): void;
  setExpression(expression: ExpressionState, weight?: number): void;
  triggerGesture(gesture: GestureType): void;
  setViseme(viseme: VisemeType, intensity: number): void;
  onCandidateAudioLevel(level: number): void;
  onCandidateGaze(normalizedX: number, normalizedY: number): void;
  speak(text: string, onEnd?: () => void): void;
  stopSpeaking(): void;
  resize(width: number, height: number): void;
  onReady?(callback: () => void): void;
  onStateChange?(callback: (state: AvatarState) => void): void;
  attachMount?(container: HTMLElement, videoOrCanvas?: HTMLElement): void;
  dispose(): void;
}

export interface ExternalProviderConfig {
  vendor?: string;
  avatarId?: string;
  streamUrl?: string;
  apiBaseUrl?: string;
  sessionId?: string;
  durationMinutes?: number;
}
