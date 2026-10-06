/**
 * LocalSarah2DAvatarProvider for PrepX
 * 
 * 100% In-Browser Lightweight 2D/Canvas AI Interviewer Avatar
 * Powered by Sarah Jenkins Professional Reference Image, Canvas Transforms,
 * Facial Animation Layers (Eyes, Blinks, Saccades, Mouth Visemes, Smiles, Nods),
 * and Authoritative Synchronized Neural TTS Audio.
 * 
 * Target hardware: Intel Core i5-8365U, 16GB RAM, Intel UHD Graphics 620.
 * Zero external neural-video streaming, zero WebRTC avatar servers, zero paid API usage.
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

interface LandmarkCoords {
  headCenter: { x: number; y: number };
  leftEye: { x: number; y: number; w: number; h: number };
  rightEye: { x: number; y: number; w: number; h: number };
  mouth: { x: number; y: number; w: number; h: number };
  chin: { x: number; y: number };
}

export class LocalSarah2DAvatarProvider implements IAvatarProvider {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;

  // Reference image assets
  private referenceImage: HTMLImageElement | null = null;
  private isImageLoaded: boolean = false;
  private referenceUrl: string = "/avatars/sarah-clean.png";
  private fallbackUrl: string = "/avatars/sarah-reference.png";

  // State management
  private currentState: AvatarState = "IDLE";
  private currentExpression: ExpressionState = "NEUTRAL";
  private expressionWeight: number = 1.0;
  private statusMessage: string = "Sarah — Local AI Interviewer Ready";
  private isConfigured: boolean = true;
  private isInitialized: boolean = false;

  // Callbacks
  private readyCallbacks: Set<() => void> = new Set();
  private stateChangeCallbacks: Set<(state: AvatarState) => void> = new Set();

  // Natural Blinking animation state
  private blinkProgress: number = 0; // 0 = open, 1 = fully closed
  private isBlinking: boolean = false;
  private nextBlinkTime: number = 0;
  private blinkDurationMs: number = 150;
  private blinkStartTime: number = 0;
  private isDoubleBlinkPending: boolean = false;

  // Gaze & Saccades state
  private gazeOffset = { x: 0, y: 0 };
  private targetGaze = { x: 0, y: 0 };
  private candidateGaze = { x: 0, y: 0 };
  private nextSaccadeTime: number = 0;

  // Head Nod & Gesture state
  private nodProgress: number = 0;
  private isNodding: boolean = false;
  private nodStartTime: number = 0;
  private nodDurationMs: number = 420;
  private headTilt: number = 0; // in radians
  private targetHeadTilt: number = 0;

  // Smile / Emotion state
  private smileIntensity: number = 0;
  private targetSmileIntensity: number = 0;

  // Audio & Lip-sync Viseme state
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSourceNode: AudioBufferSourceNode | null = null;
  private activeAudioElement: HTMLAudioElement | null = null;
  private audioFreqData: Uint8Array = new Uint8Array(64);
  private currentViseme: VisemeType = "sil";
  private mouthAperture: number = 0; // 0 (closed) to 1 (wide open)
  private mouthWidthMod: number = 0; // horizontal stretch/pucker
  private isSpeakingActive: boolean = false;
  private currentSpeechAbortController: AbortController | null = null;
  private currentSpeechOnEnd: (() => void) | null = null;

  // Natural Breathing oscillation
  private ambientTime: number = 0;

  // Pixel Landmarks in sarah-clean.png (836 x 479)
  private readonly landmarks: LandmarkCoords = {
    headCenter: { x: 431, y: 120 },
    leftEye: { x: 406, y: 105, w: 22, h: 10 },
    rightEye: { x: 456, y: 105, w: 22, h: 10 },
    mouth: { x: 433, y: 168, w: 46, h: 16 },
    chin: { x: 432, y: 205 },
  };

  private apiBaseUrl: string;

  constructor(config?: ExternalProviderConfig) {
    this.apiBaseUrl =
      config?.apiBaseUrl ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000/api/v1";
    this.nextBlinkTime = performance.now() + 2500 + Math.random() * 2000;
    this.nextSaccadeTime = performance.now() + 1800 + Math.random() * 1500;
  }

  public getProviderName(): string {
    return "Sarah — Local 2D AI Interviewer";
  }

  public getProviderType(): AvatarProviderType {
    return "local_2d";
  }

  public isFallback(): boolean {
    return false;
  }

  public isReady(): boolean {
    return this.isInitialized && this.isImageLoaded;
  }

  public getStatusMessage(): string {
    return this.statusMessage;
  }

  public onReady(callback: () => void): void {
    if (this.isReady()) {
      callback();
    } else {
      this.readyCallbacks.add(callback);
    }
  }

  public onStateChange(callback: (state: AvatarState) => void): void {
    this.stateChangeCallbacks.add(callback);
    callback(this.currentState);
  }

  public async initialize(
    container: HTMLElement,
    _videoOrCanvas?: HTMLElement
  ): Promise<AvatarInitResult> {
    this.container = container;

    // Create or reuse internal Canvas
    let canvas = container.querySelector<HTMLCanvasElement>("canvas.local-sarah-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "local-sarah-canvas absolute inset-0 w-full h-full block object-cover z-0 select-none";
      canvas.style.pointerEvents = "none";
      container.appendChild(canvas);
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });

    // Load Sarah Professional Reference Image
    await this.loadReferenceImage();

    // Resize canvas to container
    this.resize(container.clientWidth, container.clientHeight);

    // Start 60fps render loop
    this.startRenderLoop();

    this.isInitialized = true;
    this.statusMessage = "Sarah — Local AI Interviewer is Ready";

    this.readyCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (_) {}
    });

    return {
      success: true,
      providerType: "local_2d",
      providerName: this.getProviderName(),
      isFallback: false,
      status: "ready",
      message: "Sarah — Local AI Interviewer initialized successfully.",
      referenceImageUrl: this.referenceUrl,
    };
  }

  public attachMount(container: HTMLElement, _videoOrCanvas?: HTMLElement): void {
    this.container = container;
    if (this.canvas && !container.contains(this.canvas)) {
      container.appendChild(this.canvas);
      this.resize(container.clientWidth, container.clientHeight);
    }
  }

  private async loadReferenceImage(): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        this.referenceImage = img;
        this.isImageLoaded = true;
        resolve();
      };

      img.onerror = () => {
        // Fallback to the full reference image if sarah-clean not yet loaded
        if (this.referenceUrl !== this.fallbackUrl) {
          this.referenceUrl = this.fallbackUrl;
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = "anonymous";
          fallbackImg.onload = () => {
            this.referenceImage = fallbackImg;
            this.isImageLoaded = true;
            resolve();
          };
          fallbackImg.onerror = () => {
            console.error("LocalSarah2DAvatarProvider: Failed to load Sarah reference image.");
            resolve();
          };
          fallbackImg.src = this.fallbackUrl;
        } else {
          resolve();
        }
      };

      img.src = this.referenceUrl;
    });
  }

  public setState(state: AvatarState): void {
    if (this.currentState === state) return;

    this.currentState = state;

    // Contextual transitions
    switch (state) {
      case "SPEAKING":
        this.targetSmileIntensity = 0.15;
        this.targetHeadTilt = 0;
        break;
      case "LISTENING":
        this.targetSmileIntensity = 0.1;
        this.targetHeadTilt = 0.015; // gentle attentive listening tilt
        this.targetGaze = { x: 0, y: 0 };
        break;
      case "THINKING":
        this.targetSmileIntensity = 0.0;
        this.targetHeadTilt = -0.035; // thoughtful tilt
        // Reflective gaze upward-right
        this.targetGaze = { x: 2.5, y: -2.5 };
        break;
      case "SMILING":
      case "ENCOURAGING":
        this.targetSmileIntensity = 0.75;
        this.targetHeadTilt = 0.01;
        this.triggerGesture("NOD_ENCOURAGING");
        break;
      case "CONCERNED":
        this.targetSmileIntensity = -0.15;
        this.targetHeadTilt = 0.02;
        break;
      case "NODDING":
        this.triggerGesture("NOD");
        break;
      case "PAUSED":
        this.targetSmileIntensity = 0;
        this.targetHeadTilt = 0;
        break;
      default:
        this.targetSmileIntensity = 0.05;
        this.targetHeadTilt = 0;
        break;
    }

    this.stateChangeCallbacks.forEach((cb) => {
      try {
        cb(state);
      } catch (_) {}
    });
  }

  public setExpression(expression: ExpressionState, weight: number = 1.0): void {
    this.currentExpression = expression;
    this.expressionWeight = weight;

    if (expression === "WARM_SMILE" || expression === "ENCOURAGING") {
      this.targetSmileIntensity = 0.8 * weight;
    } else if (expression === "THINKING") {
      this.targetSmileIntensity = 0;
      this.targetGaze = { x: 2.0, y: -2.0 };
    } else if (expression === "CONCERNED" || expression === "PROFESSIONAL_SERIOUS") {
      this.targetSmileIntensity = -0.1 * weight;
    } else {
      this.targetSmileIntensity = 0.1 * weight;
    }
  }

  public triggerGesture(gesture: GestureType): void {
    if (gesture === "NOD" || gesture === "NOD_ENCOURAGING") {
      this.isNodding = true;
      this.nodStartTime = performance.now();
      this.nodDurationMs = gesture === "NOD_ENCOURAGING" ? 480 : 380;
    } else if (gesture === "THINKING_TILT") {
      this.targetHeadTilt = -0.04;
    }
  }

  public setViseme(viseme: VisemeType, intensity: number): void {
    this.currentViseme = viseme;
    this.mouthAperture = Math.max(0, Math.min(1, intensity));
  }

  public onCandidateAudioLevel(level: number): void {
    // When candidate speaks with high energy during listening, Sarah gives subtle acknowledgement
    if (this.currentState === "LISTENING" && level > 45 && !this.isNodding) {
      if (Math.random() < 0.25) {
        this.triggerGesture("NOD");
      }
    }
  }

  public onCandidateGaze(normalizedX: number, normalizedY: number): void {
    this.candidateGaze = {
      x: Math.max(-1, Math.min(1, normalizedX)),
      y: Math.max(-1, Math.min(1, normalizedY)),
    };
  }

  public resize(width: number, height: number): void {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
  }

  // ---------------- Authoritative Speech & TTS Pipeline ----------------

  public async speak(text: string, onEnd?: () => void): Promise<void> {
    if (!text || !text.trim()) {
      onEnd?.();
      return;
    }

    // 1. Cancel previous speech immediately
    this.stopSpeaking();

    this.currentSpeechAbortController = new AbortController();
    const signal = this.currentSpeechAbortController.signal;
    this.currentSpeechOnEnd = onEnd || null;

    this.setState("SPEAKING");
    this.isSpeakingActive = true;

    try {
      // 2. Authoritative TTS via PrepX backend Edge TTS endpoint
      const response = await fetch(`${this.apiBaseUrl}/avatar/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          voice: "en-US-JennyNeural",
          speed: 1.0,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`TTS server HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (signal.aborted) return;

      await this.playAudioBuffer(arrayBuffer, signal);
    } catch (err: any) {
      if (signal.aborted) return;
      console.warn("Backend TTS notice, falling back to Web Speech Synthesis:", err?.message);
      this.playSpeechSynthesisFallback(text, signal);
    }
  }

  private async playAudioBuffer(arrayBuffer: ArrayBuffer, signal: AbortSignal): Promise<void> {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      this.playSpeechSynthesisFallback("", signal);
      return;
    }

    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    const decodedBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    if (signal.aborted) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = decodedBuffer;

    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.7;

    source.connect(analyser);
    analyser.connect(this.audioCtx.destination);

    this.analyser = analyser;
    this.audioSourceNode = source;

    source.onended = () => {
      this.handleSpeechCompleted();
    };

    source.start(0);
  }

  private playSpeechSynthesisFallback(text: string, signal: AbortSignal): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.handleSpeechCompleted();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    // Pick female voice if available
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Female") ||
          v.name.includes("Samantha") ||
          v.name.includes("Jenny") ||
          v.name.includes("Victoria") ||
          v.name.includes("Natural"))
    );
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onend = () => {
      this.handleSpeechCompleted();
    };

    utterance.onerror = () => {
      this.handleSpeechCompleted();
    };

    // Synthetic viseme simulation for speech synthesis
    let wordIndex = 0;
    utterance.onboundary = (event) => {
      if (event.name === "word") {
        wordIndex++;
        const targetAperture = (wordIndex % 2 === 0 ? 0.65 : 0.85) + Math.random() * 0.15;
        this.mouthAperture = targetAperture;
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking(): void {
    if (this.currentSpeechAbortController) {
      this.currentSpeechAbortController.abort();
      this.currentSpeechAbortController = null;
    }

    if (this.audioSourceNode) {
      try {
        this.audioSourceNode.stop();
        this.audioSourceNode.disconnect();
      } catch (_) {}
      this.audioSourceNode = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    this.isSpeakingActive = false;
    this.mouthAperture = 0;
    this.currentViseme = "sil";
  }

  private handleSpeechCompleted(): void {
    this.isSpeakingActive = false;
    this.mouthAperture = 0;
    this.currentViseme = "sil";
    this.setState("LISTENING");

    if (this.currentSpeechOnEnd) {
      const cb = this.currentSpeechOnEnd;
      this.currentSpeechOnEnd = null;
      cb();
    }
  }

  // ---------------- 60 FPS Canvas Rendering Engine ----------------

  private startRenderLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    const render = (now: number) => {
      this.updateState(now);
      this.drawFrame();
      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  private updateState(now: number): void {
    this.ambientTime += 0.025;

    // 1. Update Natural Blinking
    if (!this.isBlinking && now >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkStartTime = now;
      this.blinkDurationMs = 130 + Math.random() * 60;
    }

    if (this.isBlinking) {
      const elapsed = now - this.blinkStartTime;
      const t = elapsed / this.blinkDurationMs;
      if (t >= 1.0) {
        this.isBlinking = false;
        this.blinkProgress = 0;

        // Occasional natural double blink (18% probability)
        if (Math.random() < 0.18 && !this.isDoubleBlinkPending) {
          this.isDoubleBlinkPending = true;
          this.nextBlinkTime = now + 150 + Math.random() * 80;
        } else {
          this.isDoubleBlinkPending = false;
          this.nextBlinkTime = now + 2800 + Math.random() * 3200;
        }
      } else {
        // Sinusoidal blink curve (fast shut, smooth open)
        this.blinkProgress = Math.sin(t * Math.PI);
      }
    }

    // 2. Update Saccades & Eye Gaze
    if (now >= this.nextSaccadeTime) {
      if (this.currentState === "THINKING") {
        this.targetGaze = {
          x: 2.0 + (Math.random() * 1.5 - 0.75),
          y: -2.2 + (Math.random() * 1.2 - 0.6),
        };
      } else {
        // Natural micro-saccades around candidate mouse or camera center
        const mouseX = this.candidateGaze.x * 2.2;
        const mouseY = this.candidateGaze.y * 1.8;
        const jitterX = (Math.random() - 0.5) * 1.2;
        const jitterY = (Math.random() - 0.5) * 0.8;
        this.targetGaze = { x: mouseX + jitterX, y: mouseY + jitterY };
      }
      this.nextSaccadeTime = now + 1600 + Math.random() * 2200;
    }

    // Smoothly interpolate eye gaze toward target
    this.gazeOffset.x += (this.targetGaze.x - this.gazeOffset.x) * 0.12;
    this.gazeOffset.y += (this.targetGaze.y - this.gazeOffset.y) * 0.12;

    // 3. Update Head Nodding
    if (this.isNodding) {
      const nodElapsed = now - this.nodStartTime;
      const t = nodElapsed / this.nodDurationMs;
      if (t >= 1.0) {
        this.isNodding = false;
        this.nodProgress = 0;
      } else {
        // Damped harmonic nod dip
        this.nodProgress = Math.sin(t * Math.PI * 1.5) * (1 - t * 0.7);
      }
    }

    // Smoothly interpolate head tilt and smile
    this.headTilt += (this.targetHeadTilt - this.headTilt) * 0.08;
    this.smileIntensity += (this.targetSmileIntensity - this.smileIntensity) * 0.1;

    // 4. Update Lip-sync Visemes from Real-Time Audio Energy
    if (this.isSpeakingActive && this.analyser) {
      this.analyser.getByteFrequencyData(this.audioFreqData as any);

      // Low, mid, high frequencies energy
      let lowEnergy = 0;
      let midEnergy = 0;
      let highEnergy = 0;

      for (let i = 0; i < 8; i++) lowEnergy += this.audioFreqData[i];
      for (let i = 8; i < 24; i++) midEnergy += this.audioFreqData[i];
      for (let i = 24; i < 48; i++) highEnergy += this.audioFreqData[i];

      lowEnergy /= 8 * 255;
      midEnergy /= 16 * 255;
      highEnergy /= 24 * 255;

      const totalEnergy = (lowEnergy * 0.3 + midEnergy * 0.5 + highEnergy * 0.2);

      // Target mouth aperture derived directly from audio volume & frequency
      const targetAperture = Math.min(Math.max((totalEnergy - 0.08) * 1.6, 0), 1);
      this.mouthAperture += (targetAperture - this.mouthAperture) * 0.35;

      // Shape modulation
      if (highEnergy > midEnergy * 1.1) {
        this.mouthWidthMod = 0.4; // wide sibilant (s/z/e)
      } else if (lowEnergy > midEnergy * 1.2) {
        this.mouthWidthMod = -0.3; // rounded (o/u)
      } else {
        this.mouthWidthMod = 0.0; // neutral open (a)
      }
    } else if (!this.isSpeakingActive) {
      this.mouthAperture += (0 - this.mouthAperture) * 0.2;
      this.mouthWidthMod += (0 - this.mouthWidthMod) * 0.2;
    }
  }

  private drawFrame(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas || !this.referenceImage || !this.isImageLoaded) {
      // Clear neutral dark slate background while loading
      if (ctx && canvas) {
        ctx.fillStyle = "#070b14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const cssWidth = parseFloat(canvas.style.width) || canvas.width;
    const cssHeight = parseFloat(canvas.style.height) || canvas.height;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Reference dimensions
    const imgW = this.referenceImage.naturalWidth || 836;
    const imgH = this.referenceImage.naturalHeight || 479;

    // Calculate object-cover scale
    const scale = Math.max(cssWidth / imgW, cssHeight / imgH);
    const renderW = imgW * scale;
    const renderH = imgH * scale;
    const offsetX = (cssWidth - renderW) / 2;
    const offsetY = (cssHeight - renderH) / 2;

    // Calculate subtle organic head motion
    const breathingY = Math.sin(this.ambientTime) * 0.8;
    const nodY = this.nodProgress * 5.0;
    const totalHeadOffsetY = breathingY + nodY;

    ctx.save();

    // 1. Draw Base Reference Video Frame
    // Subtle head tilt transform anchored at Sarah's chest / base of neck
    const anchorX = offsetX + this.landmarks.headCenter.x * scale;
    const anchorY = offsetY + this.landmarks.chin.y * scale + 60 * scale;

    ctx.translate(anchorX, anchorY);
    ctx.rotate(this.headTilt);
    ctx.translate(-anchorX, -anchorY + totalHeadOffsetY);

    // Draw reference image
    ctx.drawImage(this.referenceImage, offsetX, offsetY, renderW, renderH);

    // Transform helper: maps landmark pixel coords to current canvas space
    const toCanvasX = (px: number) => offsetX + px * scale;
    const toCanvasY = (py: number) => offsetY + py * scale;

    // 2. Draw Natural Eye Movement & Saccades (Iris shifts)
    this.drawEyes(ctx, toCanvasX, toCanvasY, scale);

    // 3. Draw Natural Blinking Eyelid Layers
    if (this.blinkProgress > 0.02) {
      this.drawBlink(ctx, toCanvasX, toCanvasY, scale);
    }

    // 4. Draw Smile & Subtle Facial Expressions
    if (Math.abs(this.smileIntensity) > 0.05) {
      this.drawSmileExpression(ctx, toCanvasX, toCanvasY, scale);
    }

    // 5. Draw Lip-sync & Phonetic Mouth Animation
    if (this.mouthAperture > 0.04) {
      this.drawMouthSpeech(ctx, toCanvasX, toCanvasY, scale);
    }

    ctx.restore();
  }

  /**
   * Eye movement & saccade rendering:
   * Moves the iris & pupil naturally within the eye bounds while keeping sclera and eyelids intact.
   */
  private drawEyes(
    ctx: CanvasRenderingContext2D,
    toCanvasX: (px: number) => number,
    toCanvasY: (py: number) => number,
    scale: number
  ): void {
    const shiftX = this.gazeOffset.x * scale;
    const shiftY = this.gazeOffset.y * scale;

    if (Math.abs(shiftX) < 0.1 && Math.abs(shiftY) < 0.1) return;

    const eyes = [this.landmarks.leftEye, this.landmarks.rightEye];

    eyes.forEach((eye) => {
      const cx = toCanvasX(eye.x);
      const cy = toCanvasY(eye.y);
      const rx = (eye.w / 2) * scale;
      const ry = (eye.h / 2) * scale;

      ctx.save();
      // Clip strictly within eye fissure
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.95, ry * 0.85, 0, 0, Math.PI * 2);
      ctx.clip();

      // Draw subtle iris micro-shift
      ctx.fillStyle = "rgba(45, 28, 20, 0.4)";
      ctx.beginPath();
      ctx.arc(cx + shiftX, cy + shiftY, 4.2 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Pupil center
      ctx.fillStyle = "rgba(10, 8, 8, 0.7)";
      ctx.beginPath();
      ctx.arc(cx + shiftX * 1.1, cy + shiftY * 1.1, 2.0 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Specular cornea highlight reflection
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.beginPath();
      ctx.arc(cx + shiftX - 1.2 * scale, cy + shiftY - 1.2 * scale, 1.1 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  /**
   * Blinking layer rendering:
   * Draws a smooth descending upper eyelid matching Sarah's skin tone and lash line.
   */
  private drawBlink(
    ctx: CanvasRenderingContext2D,
    toCanvasX: (px: number) => number,
    toCanvasY: (py: number) => number,
    scale: number
  ): void {
    const p = Math.min(1, Math.max(0, this.blinkProgress));
    const eyes = [this.landmarks.leftEye, this.landmarks.rightEye];

    eyes.forEach((eye) => {
      const cx = toCanvasX(eye.x);
      const cy = toCanvasY(eye.y);
      const rx = (eye.w / 2) * scale * 1.15;
      const ry = (eye.h / 2) * scale * 1.2;

      ctx.save();

      // Eyelid skin patch
      const lidY = cy - ry + ry * 2 * p;

      // Upper eyelid smooth cover
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy);
      ctx.quadraticCurveTo(cx, cy - ry, cx + rx, cy);
      ctx.quadraticCurveTo(cx, lidY, cx - rx, cy);
      ctx.closePath();

      // Matching Sarah's exact eyelid tone: #d59f7d with natural shadow
      const grad = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
      grad.addColorStop(0, "#cb916d");
      grad.addColorStop(0.5, "#d9a785");
      grad.addColorStop(1, "#c58a66");

      ctx.fillStyle = grad;
      ctx.fill();

      // Natural Eyelash Line along bottom edge of eyelid
      if (p > 0.4) {
        ctx.strokeStyle = `rgba(32, 18, 14, ${p * 0.85})`;
        ctx.lineWidth = 1.4 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - rx * 0.95, lidY);
        ctx.quadraticCurveTo(cx, lidY + 1.2 * scale, cx + rx * 0.95, lidY);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  /**
   * Natural small smile rendering:
   * Curves the lip corners smoothly and adds a warm cheek radiance.
   */
  private drawSmileExpression(
    ctx: CanvasRenderingContext2D,
    toCanvasX: (px: number) => number,
    toCanvasY: (py: number) => number,
    scale: number
  ): void {
    const s = this.smileIntensity;
    const mx = toCanvasX(this.landmarks.mouth.x);
    const my = toCanvasY(this.landmarks.mouth.y);
    const mw = (this.landmarks.mouth.w / 2) * scale;

    ctx.save();

    // Subtle upward curve on lip corners
    const liftY = -s * 2.8 * scale;

    ctx.strokeStyle = `rgba(142, 60, 52, ${Math.abs(s) * 0.45})`;
    ctx.lineWidth = 1.2 * scale;
    ctx.lineCap = "round";

    // Left lip corner
    ctx.beginPath();
    ctx.moveTo(mx - mw * 0.95, my + 1 * scale);
    ctx.quadraticCurveTo(mx - mw * 0.6, my + liftY, mx - mw * 0.2, my);
    ctx.stroke();

    // Right lip corner
    ctx.beginPath();
    ctx.moveTo(mx + mw * 0.2, my);
    ctx.quadraticCurveTo(mx + mw * 0.6, my + liftY, mx + mw * 0.95, my + 1 * scale);
    ctx.stroke();

    // Subtle warm cheek radiance in smiling/encouraging mode
    if (s > 0.3) {
      const cheekLeft = toCanvasX(375);
      const cheekRight = toCanvasX(485);
      const cheekY = toCanvasY(135);

      const cheekGradLeft = ctx.createRadialGradient(cheekLeft, cheekY, 2, cheekLeft, cheekY, 18 * scale);
      cheekGradLeft.addColorStop(0, `rgba(244, 63, 94, ${s * 0.12})`);
      cheekGradLeft.addColorStop(1, "transparent");
      ctx.fillStyle = cheekGradLeft;
      ctx.beginPath();
      ctx.arc(cheekLeft, cheekY, 18 * scale, 0, Math.PI * 2);
      ctx.fill();

      const cheekGradRight = ctx.createRadialGradient(cheekRight, cheekY, 2, cheekRight, cheekY, 18 * scale);
      cheekGradRight.addColorStop(0, `rgba(244, 63, 94, ${s * 0.12})`);
      cheekGradRight.addColorStop(1, "transparent");
      ctx.fillStyle = cheekGradRight;
      ctx.beginPath();
      ctx.arc(cheekRight, cheekY, 18 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Lip-sync / Viseme speech mouth animation:
   * Smoothly opens the mouth aperture, revealing natural oral cavity,
   * subtle teeth row, and upper/lower lips in Sarah's exact rose/berry tone.
   */
  private drawMouthSpeech(
    ctx: CanvasRenderingContext2D,
    toCanvasX: (px: number) => number,
    toCanvasY: (py: number) => number,
    scale: number
  ): void {
    const a = this.mouthAperture;
    const mx = toCanvasX(this.landmarks.mouth.x);
    const my = toCanvasY(this.landmarks.mouth.y);
    const baseW = (this.landmarks.mouth.w / 2) * scale;

    // Width and height modulation based on vowel type
    const curW = baseW * (1 + this.mouthWidthMod * 0.2);
    const openH = a * 8.5 * scale;

    ctx.save();

    // 1. Inner Mouth Cavity
    ctx.beginPath();
    ctx.ellipse(mx, my + 1 * scale, curW * 0.72, openH * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#220a06"; // Deep oral cavity
    ctx.fill();

    // 2. Upper Teeth Hint (visible when mouth is moderately to widely open)
    if (a > 0.22) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(mx, my + 1 * scale, curW * 0.72, openH * 0.85, 0, 0, Math.PI * 2);
      ctx.clip();

      const teethY = my - openH * 0.35;
      const teethH = Math.min(3.2 * scale, openH * 0.6);

      ctx.fillStyle = "#eae5e1"; // Natural off-white enamel
      ctx.beginPath();
      ctx.rect(mx - curW * 0.45, teethY, curW * 0.9, teethH);
      ctx.fill();

      // Subtle dental division lines
      ctx.strokeStyle = "rgba(60, 40, 35, 0.25)";
      ctx.lineWidth = 0.6 * scale;
      for (let i = -2; i <= 2; i++) {
        const lineX = mx + i * (curW * 0.18);
        ctx.beginPath();
        ctx.moveTo(lineX, teethY);
        ctx.lineTo(lineX, teethY + teethH);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 3. Lower Lip Contour & Lipstick Tint (#9c4c47)
    ctx.beginPath();
    ctx.moveTo(mx - curW, my);
    ctx.quadraticCurveTo(mx, my + openH + 3.5 * scale, mx + curW, my);
    ctx.quadraticCurveTo(mx, my + openH * 0.4, mx - curW, my);
    ctx.closePath();

    const lowerLipGrad = ctx.createLinearGradient(mx, my, mx, my + openH + 4 * scale);
    lowerLipGrad.addColorStop(0, "#9c4c47");
    lowerLipGrad.addColorStop(0.6, "#b6605a");
    lowerLipGrad.addColorStop(1, "#863a35");
    ctx.fillStyle = lowerLipGrad;
    ctx.fill();

    // 4. Upper Lip Contour
    ctx.beginPath();
    ctx.moveTo(mx - curW, my);
    ctx.quadraticCurveTo(mx - curW * 0.3, my - 2.2 * scale, mx, my - 1.2 * scale);
    ctx.quadraticCurveTo(mx + curW * 0.3, my - 2.2 * scale, mx + curW, my);
    ctx.quadraticCurveTo(mx, my - openH * 0.2, mx - curW, my);
    ctx.closePath();

    const upperLipGrad = ctx.createLinearGradient(mx, my - 3 * scale, mx, my);
    upperLipGrad.addColorStop(0, "#8a3e39");
    upperLipGrad.addColorStop(1, "#a8544e");
    ctx.fillStyle = upperLipGrad;
    ctx.fill();

    // 5. Lip corner depth shadow
    ctx.fillStyle = "rgba(40, 15, 12, 0.4)";
    ctx.beginPath();
    ctx.arc(mx - curW, my, 1.4 * scale, 0, Math.PI * 2);
    ctx.arc(mx + curW, my, 1.4 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ---------------- Cleanup & Teardown ----------------

  public dispose(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.stopSpeaking();

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
      this.canvas = null;
    }

    this.ctx = null;
    this.container = null;
    this.isInitialized = false;
  }
}
