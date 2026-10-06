import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  IAvatarProvider,
  AvatarState,
  ExpressionState,
  GestureType,
  VisemeType,
  AvatarInitResult,
} from "./types";
import { VisemeEngine } from "./VisemeEngine";

interface SarahSkeleton {
  head: THREE.Bone | null;
  neck: THREE.Bone | null;
  spine03: THREE.Bone | null;
  spine02: THREE.Bone | null;
  spine01: THREE.Bone | null;
  clavicleL: THREE.Bone | null;
  clavicleR: THREE.Bone | null;
  upperarmL: THREE.Bone | null;
  lowerarmL: THREE.Bone | null;
  handL: THREE.Bone | null;
  upperarmR: THREE.Bone | null;
  lowerarmR: THREE.Bone | null;
  handR: THREE.Bone | null;
}

export class Local3DAvatarProvider implements IAvatarProvider {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private animFrameId: number | null = null;
  private clock: THREE.Clock = new THREE.Clock();

  // State management
  private currentState: AvatarState = "IDLE";
  private currentExpression: ExpressionState = "NEUTRAL";
  private expressionWeight: number = 1.0;
  private visemeEngine: VisemeEngine;
  private isInitialized: boolean = false;
  private stateCallbacks: Set<(state: AvatarState) => void> = new Set();
  private readyCallbacks: Set<() => void> = new Set();

  // 3D Scene Groups
  private rootGroup: THREE.Group = new THREE.Group();
  private characterGroup: THREE.Group = new THREE.Group();
  private sarahModel: THREE.Group | null = null;

  // Real GLB Skeleton & Bones
  private bones: SarahSkeleton = {
    head: null,
    neck: null,
    spine03: null,
    spine02: null,
    spine01: null,
    clavicleL: null,
    clavicleR: null,
    upperarmL: null,
    lowerarmL: null,
    handL: null,
    upperarmR: null,
    lowerarmR: null,
    handR: null,
  };
  private restRotations: Map<string, THREE.Euler> = new Map();

  // Real GLB SkinnedMesh & Morph Targets
  private morphMesh: THREE.SkinnedMesh | null = null;
  private morphDictionary: { [key: string]: number } = {};
  private morphInfluences: number[] = [];
  private activeMorphValues: Map<string, number> = new Map();
  private targetMorphValues: Map<string, number> = new Map();

  // Head Orientation & Gaze
  private headTargetRot = { x: 0, y: 0, z: 0 };
  private headCurrentRot = { x: 0, y: 0, z: 0 };
  private gazeTarget = { x: 0, y: 0 };
  private gazeCurrent = { x: 0, y: 0 };
  private candidateGaze = { x: 0, y: 0 };

  // Blinking
  private blinkProgress: number = 0;
  private isBlinking: boolean = false;
  private isDoubleBlink: boolean = false;
  private doubleBlinkCount: number = 0;
  private blinkDuration: number = 0.12;
  private nextBlinkTime: number = 2.5;

  // Saccades
  private nextSaccadeTime: number = 2.0;

  // Nodding
  private nodProgress: number = 0;
  private isNodding: boolean = false;
  private nodIntensity: number = 0.08;
  private nextListenNodTime: number = 5.0;

  // Purposeful Hand Gestures
  private gestureType: GestureType = "RESTING_DESK";
  private gestureProgress: number = 1.0;
  private gestureDuration: number = 2.2;

  // Viseme & Audio
  private currentViseme: VisemeType = "sil";
  private visemeIntensity: number = 0;
  private candidateAudioLevel: number = 0;
  private currentAudioEnergy: number = 0;

  // Edge TTS Audio & Analyser
  private apiBaseUrl: string =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSourceNode: AudioBufferSourceNode | null = null;
  private currentSpeechAbortController: AbortController | null = null;
  private currentSpeechOnEnd: (() => void) | null = null;
  private isSpeakingActive: boolean = false;
  private audioFrequencyData: Uint8Array = new Uint8Array(64);

  constructor() {
    this.visemeEngine = new VisemeEngine((viseme, intensity) => {
      this.currentViseme = viseme;
      this.visemeIntensity = intensity;
    });

    if (typeof window !== "undefined") {
      (window as any).__sarahAvatar = {
        isReady: () => this.isInitialized && this.sarahModel !== null,
        speak: (text: string, onEnd?: () => void) => this.speak(text, onEnd),
        stop: () => this.stopSpeaking(),
        setState: (st: AvatarState) => this.setState(st),
        setExpression: (exp: ExpressionState, w?: number) => this.setExpression(exp, w),
        triggerGesture: (g: GestureType) => this.triggerGesture(g),
        triggerNod: (i?: number) => this.triggerNod(i),
        onCandidateGaveStrongAnswer: () => this.onCandidateGaveStrongAnswer(),
        onCandidateGaveWeakAnswer: () => this.onCandidateGaveWeakAnswer(),
        onInterviewerThinking: () => this.onInterviewerThinking(),
        onInterviewPaused: () => this.onInterviewPaused(),
        onInterviewResumed: () => this.onInterviewResumed(),
        getState: () => ({
          state: this.currentState,
          expression: this.currentExpression,
          isSpeaking: this.isSpeakingActive,
          gesture: this.gestureType,
          viseme: this.currentViseme,
          isReady: this.isInitialized && this.sarahModel !== null,
        }),
      };
    }
  }

  public getProviderName(): string {
    return "Sarah Jenkins — Senior AI Technical Recruiter (3D)";
  }

  public getProviderType() {
    return "local_3d" as const;
  }

  public isFallback(): boolean {
    return false;
  }

  public isReady(): boolean {
    return this.isInitialized && this.sarahModel !== null;
  }

  public getStatusMessage(): string {
    if (!this.isInitialized) return "Initializing 3D Interviewer...";
    if (this.currentState === "SPEAKING") return "Sarah is speaking...";
    if (this.currentState === "LISTENING") return "Sarah is listening attentively...";
    if (this.currentState === "THINKING") return "Sarah is formulating a response...";
    return "Sarah Jenkins is ready.";
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
  }

  public attachMount(container: HTMLElement, canvasElement?: HTMLElement): void {
    this.container = container;
    if (canvasElement && canvasElement instanceof HTMLCanvasElement) {
      this.canvas = canvasElement;
    } else if (this.canvas && !container.contains(this.canvas)) {
      container.appendChild(this.canvas);
    }
  }

  public async initialize(
    container: HTMLElement,
    canvasElement?: HTMLElement
  ): Promise<AvatarInitResult> {
    this.container = container;

    // 1. Setup Canvas
    if (canvasElement && canvasElement instanceof HTMLCanvasElement) {
      this.canvas = canvasElement;
    } else {
      let existingCanvas = container.querySelector("canvas") as HTMLCanvasElement;
      if (existingCanvas) {
        this.canvas = existingCanvas;
      } else {
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.display = "block";
        container.appendChild(this.canvas);
      }
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 2. High-performance WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false;

    // 3. Scene
    this.scene = new THREE.Scene();
    this.scene.add(this.rootGroup);
    this.rootGroup.add(this.characterGroup);

    // 4. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 30);
    this.camera.position.set(0, 0.22, 1.95);
    this.camera.lookAt(0, 0.18, 0);

    // 5. Studio Lighting
    this.setupLighting();

    // 6. Professional Office Environment
    this.setupOfficeEnvironment();

    // 7. Load Production Sarah GLB Model
    try {
      await this.loadSarahGLB();
    } catch (err: any) {
      console.error("FATAL: Failed to load sarah.glb:", err);
      return {
        success: false,
        providerType: "local_3d",
        providerName: this.getProviderName(),
        isFallback: false,
        status: "error",
        message: `Failed to load sarah.glb: ${err?.message || err}`,
      };
    }

    // 8. Start Render Loop
    this.clock.start();
    this.animate();

    this.isInitialized = true;
    this.readyCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (_) {}
    });

    return {
      success: true,
      providerType: "local_3d",
      providerName: this.getProviderName(),
      isFallback: false,
      status: "ready",
      message: "Sarah Jenkins 3D Human Avatar ready.",
      targetPersona: "Sarah Jenkins - Senior AI Technical Recruiter",
    };
  }

  private setupLighting() {
    if (!this.scene) return;

    const ambientLight = new THREE.AmbientLight(0xf8f9fa, 0.80);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.20);
    keyLight.position.set(0.8, 1.8, 2.0);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0fa, 0.70);
    fillLight.position.set(-1.0, 1.4, 1.6);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf1f5f9, 0.90);
    rimLight.position.set(0.2, 1.8, -1.6);
    this.scene.add(rimLight);

    const deskBounce = new THREE.PointLight(0xfef3c7, 0.40, 3);
    deskBounce.position.set(0, -0.25, 0.8);
    this.scene.add(deskBounce);
  }

  private setupOfficeEnvironment() {
    if (!this.scene) return;

    // 1. Office Backdrop Wall
    const bgGeo = new THREE.PlaneGeometry(8, 5);
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = 1024;
    bgCanvas.height = 640;
    const bgCtx = bgCanvas.getContext("2d")!;

    const grad = bgCtx.createLinearGradient(0, 0, 1024, 640);
    grad.addColorStop(0, "#e8ecf2");
    grad.addColorStop(0.4, "#dfe4ec");
    grad.addColorStop(1, "#c8d1de");
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, 1024, 640);

    bgCtx.fillStyle = "rgba(71, 85, 105, 0.14)";
    bgCtx.fillRect(80, 80, 240, 480);
    bgCtx.fillRect(720, 100, 240, 460);

    for (let y = 140; y < 520; y += 75) {
      bgCtx.fillStyle = "rgba(100, 116, 139, 0.2)";
      bgCtx.fillRect(80, y, 240, 8);
      bgCtx.fillRect(720, y + 10, 240, 8);

      bgCtx.fillStyle = "rgba(79, 70, 229, 0.12)";
      bgCtx.fillRect(100, y - 45, 20, 45);
      bgCtx.fillStyle = "rgba(16, 185, 129, 0.12)";
      bgCtx.fillRect(125, y - 55, 30, 55);
      bgCtx.fillStyle = "rgba(245, 158, 11, 0.12)";
      bgCtx.fillRect(160, y - 40, 25, 40);
    }

    const drawBokehPlant = (cx: number, cy: number) => {
      bgCtx.fillStyle = "rgba(34, 197, 94, 0.15)";
      bgCtx.beginPath();
      bgCtx.ellipse(cx, cy, 50, 70, -0.2, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.fillStyle = "rgba(22, 163, 74, 0.18)";
      bgCtx.beginPath();
      bgCtx.ellipse(cx + 35, cy - 20, 45, 65, 0.3, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.fillStyle = "rgba(21, 128, 61, 0.14)";
      bgCtx.beginPath();
      bgCtx.ellipse(cx - 30, cy + 15, 40, 55, -0.4, 0, Math.PI * 2);
      bgCtx.fill();
    };
    drawBokehPlant(340, 280);
    drawBokehPlant(680, 290);

    const bgTexture = new THREE.CanvasTexture(bgCanvas);
    const bgMat = new THREE.MeshBasicMaterial({ map: bgTexture });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 0.5, -2.5);
    this.scene.add(bgMesh);

    // 2. Scandinavian Light Oak Desk
    const deskGeo = new THREE.BoxGeometry(4.2, 0.8, 1.6);
    const woodCanvas = document.createElement("canvas");
    woodCanvas.width = 512;
    woodCanvas.height = 512;
    const wCtx = woodCanvas.getContext("2d")!;
    wCtx.fillStyle = "#d7b48f";
    wCtx.fillRect(0, 0, 512, 512);
    wCtx.strokeStyle = "rgba(180, 140, 105, 0.35)";
    wCtx.lineWidth = 2;
    for (let i = 0; i < 512; i += 8) {
      wCtx.beginPath();
      wCtx.moveTo(0, i + Math.sin(i * 0.05) * 6);
      wCtx.bezierCurveTo(150, i + 5, 350, i - 5, 512, i + Math.sin(i * 0.04) * 8);
      wCtx.stroke();
    }
    const woodTexture = new THREE.CanvasTexture(woodCanvas);
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(2, 1);

    const deskMat = new THREE.MeshStandardMaterial({
      map: woodTexture,
      roughness: 0.45,
      metalness: 0.05,
    });
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.position.set(0, -0.68, 0.85);
    this.scene.add(deskMesh);

    // 3. Leather Executive Notebook & Pen
    const notebookGroup = new THREE.Group();
    const nbGeo = new THREE.BoxGeometry(0.36, 0.04, 0.48);
    const nbMat = new THREE.MeshStandardMaterial({
      color: 0x6e3d23,
      roughness: 0.65,
      metalness: 0.1,
    });
    const nbMesh = new THREE.Mesh(nbGeo, nbMat);
    notebookGroup.add(nbMesh);

    const pagesGeo = new THREE.BoxGeometry(0.34, 0.03, 0.46);
    const pagesMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ea, roughness: 0.8 });
    const pagesMesh = new THREE.Mesh(pagesGeo, pagesMat);
    pagesMesh.position.set(0.01, 0, 0);
    notebookGroup.add(pagesMesh);

    const ribbonGeo = new THREE.BoxGeometry(0.02, 0.005, 0.14);
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.set(0.04, 0.022, 0.26);
    ribbon.rotation.y = 0.15;
    notebookGroup.add(ribbon);

    notebookGroup.position.set(0.72, -0.26, 0.8);
    notebookGroup.rotation.y = -0.25;
    this.scene.add(notebookGroup);

    const penGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.28, 12);
    const penMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.2,
    });
    const pen = new THREE.Mesh(penGeo, penMat);
    pen.rotation.x = Math.PI / 2;
    pen.rotation.z = 0.2;
    pen.position.set(0.68, -0.235, 0.78);
    this.scene.add(pen);
  }

  private loadSarahGLB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      const glbUrl = "/avatars/sarah.glb";

      loader.load(
        glbUrl,
        (gltf) => {
          this.sarahModel = gltf.scene;

          // Seated naturally behind office desk
          this.characterGroup.position.set(0, -1.35, 0);
          this.characterGroup.add(this.sarahModel);

          // 1. Identify Skeleton Bones
          this.sarahModel.traverse((child) => {
            if ((child as THREE.Bone).isBone) {
              const bone = child as THREE.Bone;
              const name = bone.name;

              this.restRotations.set(name, bone.rotation.clone());

              switch (name) {
                case "head":
                  this.bones.head = bone;
                  break;
                case "neck_01":
                  this.bones.neck = bone;
                  break;
                case "spine_03":
                  this.bones.spine03 = bone;
                  break;
                case "spine_02":
                  this.bones.spine02 = bone;
                  break;
                case "spine_01":
                  this.bones.spine01 = bone;
                  break;
                case "clavicle_l":
                  this.bones.clavicleL = bone;
                  break;
                case "clavicle_r":
                  this.bones.clavicleR = bone;
                  break;
                case "upperarm_l":
                  this.bones.upperarmL = bone;
                  break;
                case "lowerarm_l":
                  this.bones.lowerarmL = bone;
                  break;
                case "hand_l":
                  this.bones.handL = bone;
                  break;
                case "upperarm_r":
                  this.bones.upperarmR = bone;
                  break;
                case "lowerarm_r":
                  this.bones.lowerarmR = bone;
                  break;
                case "hand_r":
                  this.bones.handR = bone;
                  break;
              }
            }

            // 2. Identify SkinnedMesh with Morph Targets
            if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
              const mesh = child as THREE.SkinnedMesh;
              mesh.frustumCulled = false;

              if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
                this.morphMesh = mesh;
                this.morphDictionary = mesh.morphTargetDictionary;
                this.morphInfluences = mesh.morphTargetInfluences;
              }
            }
          });

          const foundBones = Object.entries(this.bones)
            .filter(([_, b]) => b !== null)
            .map(([k]) => k);
          const foundMorphCount = Object.keys(this.morphDictionary).length;
          console.info(
            `[Local3DAvatarProvider] sarah.glb loaded: ${foundBones.length} bones, ${foundMorphCount} morph targets.`
          );

          this.applyBaseDeskArmPose();
          resolve();
        },
        undefined,
        (error) => {
          console.error("[Local3DAvatarProvider] Error loading sarah.glb:", error);
          reject(error);
        }
      );
    });
  }

  private applyBaseDeskArmPose() {
    if (this.bones.upperarmL && this.restRotations.has("upperarm_l")) {
      const rest = this.restRotations.get("upperarm_l")!;
      this.bones.upperarmL.rotation.set(rest.x + 0.31, rest.y + 0.17, rest.z - 0.26);
    }
    if (this.bones.lowerarmL && this.restRotations.has("lowerarm_l")) {
      const rest = this.restRotations.get("lowerarm_l")!;
      this.bones.lowerarmL.rotation.set(rest.x + 0.91, rest.y, rest.z);
    }
    if (this.bones.upperarmR && this.restRotations.has("upperarm_r")) {
      const rest = this.restRotations.get("upperarm_r")!;
      this.bones.upperarmR.rotation.set(rest.x + 0.31, rest.y - 0.17, rest.z + 0.26);
    }
    if (this.bones.lowerarmR && this.restRotations.has("lowerarm_r")) {
      const rest = this.restRotations.get("lowerarm_r")!;
      this.bones.lowerarmR.rotation.set(rest.x + 0.91, rest.y, rest.z);
    }
  }

  private setTargetMorph(name: string, targetValue: number): void {
    if (this.morphDictionary[name] === undefined) return;
    this.targetMorphValues.set(name, Math.max(0.0, Math.min(1.0, targetValue)));
  }

  public setState(state: AvatarState): void {
    if (this.currentState === state) return;
    this.currentState = state;

    this.stateCallbacks.forEach((cb) => {
      try {
        cb(state);
      } catch (_) {}
    });

    switch (state) {
      case "SPEAKING":
        this.triggerGesture("SPEAKING_EMPHASIS_RIGHT");
        break;
      case "THINKING":
        this.headTargetRot.x = -0.04;
        this.headTargetRot.y = 0.06;
        this.headTargetRot.z = 0.04;
        this.triggerGesture("THINKING_TILT");
        break;
      case "LISTENING":
        this.headTargetRot.x = 0.02;
        this.headTargetRot.y = 0;
        this.headTargetRot.z = 0;
        this.gestureType = "RESTING_DESK";
        this.gestureProgress = 1.0;
        break;
      case "SMILING":
      case "ENCOURAGING":
        this.triggerNod(0.08);
        break;
      case "PAUSED":
      case "COMPLETED":
        this.headTargetRot.x = 0;
        this.headTargetRot.y = 0;
        this.headTargetRot.z = 0;
        this.gestureType = "RESTING_DESK";
        this.gestureProgress = 1.0;
        break;
      default:
        this.headTargetRot.x = 0;
        this.headTargetRot.y = 0;
        this.headTargetRot.z = 0;
        break;
    }
  }

  public setExpression(expression: ExpressionState, weight: number = 1.0): void {
    this.currentExpression = expression;
    this.expressionWeight = Math.max(0.0, Math.min(1.0, weight));
  }

  public triggerGesture(gesture: GestureType): void {
    this.gestureType = gesture;
    this.gestureProgress = 0.0;
    if (gesture === "EXPLAINING_OPEN_PALMS") {
      this.gestureDuration = 2.4;
    } else if (gesture === "NOD_ENCOURAGING") {
      this.gestureDuration = 1.8;
      this.triggerNod(0.08);
    } else if (gesture === "THINKING_TILT") {
      this.gestureDuration = 2.0;
    } else {
      this.gestureDuration = 2.2;
    }
  }

  public setViseme(viseme: VisemeType, intensity: number): void {
    this.currentViseme = viseme;
    this.visemeIntensity = intensity;
  }

  public onCandidateAudioLevel(level: number): void {
    this.candidateAudioLevel = level;
    if (this.currentState === "LISTENING" && level > 25 && !this.isNodding) {
      if (Math.random() < 0.08) {
        this.triggerNod(0.06);
      }
    }
  }

  public onCandidateGaze(normalizedX: number, normalizedY: number): void {
    this.candidateGaze = { x: normalizedX, y: normalizedY };
    if (this.currentState !== "THINKING") {
      this.gazeTarget = {
        x: normalizedX * 0.22,
        y: normalizedY * 0.16,
      };
    }
  }

  public triggerNod(intensity: number = 0.08): void {
    this.isNodding = true;
    this.nodProgress = 0;
    this.nodIntensity = intensity;
  }

  // --- Semantic Interview Event Handlers ---

  public onCandidateGaveStrongAnswer(): void {
    this.setExpression("WARM_SMILE", 1.0);
    this.triggerNod(0.08);
    this.triggerGesture("NOD_ENCOURAGING");
    setTimeout(() => {
      if (
        this.currentState === "LISTENING" ||
        this.currentState === "SMILING" ||
        this.currentState === "ENCOURAGING"
      ) {
        this.setExpression("LISTENING", 0.8);
      }
    }, 3500);
  }

  public onCandidateGaveWeakAnswer(): void {
    this.setExpression("CONCERNED", 1.0);
    this.headTargetRot.x = 0.03;
    this.headTargetRot.y = -0.04;
    this.headTargetRot.z = -0.03;
  }

  public onInterviewerThinking(): void {
    this.setState("THINKING");
    this.setExpression("THINKING", 1.0);
  }

  public onInterviewPaused(): void {
    this.stopSpeaking();
    this.setState("PAUSED");
    this.setExpression("NEUTRAL");
  }

  public onInterviewResumed(): void {
    this.setState("LISTENING");
    this.setExpression("LISTENING");
  }

  // --- Authoritative Speech & Lip-Sync Pipeline ---

  public async speak(text: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();

    this.currentSpeechAbortController = new AbortController();
    const signal = this.currentSpeechAbortController.signal;
    this.currentSpeechOnEnd = onEnd || null;

    this.setState("SPEAKING");

    // Semantic gesture determination based on text meaning
    const lower = text.toLowerCase().trim();
    const isQuestion =
      lower.includes("?") ||
      /^(can you|could you|tell me|what|how|why|describe)/i.test(lower);
    const isExplanation = text.split(" ").length > 12;

    if (isQuestion) {
      this.triggerGesture("EXPLAINING_OPEN_PALMS");
    } else if (isExplanation) {
      this.triggerGesture("SPEAKING_EMPHASIS_RIGHT");
    } else {
      this.gestureType = "RESTING_DESK";
      this.gestureProgress = 1.0;
    }

    try {
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

      await this.playAudioBuffer(arrayBuffer, signal, text);
    } catch (err: any) {
      if (signal.aborted) return;
      console.warn("Backend Edge TTS notice, using Web Speech Synthesis fallback:", err?.message);
      this.playSpeechSynthesisFallback(text, signal);
    }
  }

  private async playAudioBuffer(
    arrayBuffer: ArrayBuffer,
    signal: AbortSignal,
    text: string
  ): Promise<void> {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      this.playSpeechSynthesisFallback(text, signal);
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
    analyser.smoothingTimeConstant = 0.6;

    source.connect(analyser);
    analyser.connect(this.audioCtx.destination);

    this.analyser = analyser;
    this.audioSourceNode = source;
    this.audioFrequencyData = new Uint8Array(analyser.frequencyBinCount);

    source.onended = () => {
      this.handleSpeechCompleted();
    };

    // Synchronize lip-sync start exactly with audio playback clock
    this.isSpeakingActive = true;
    this.visemeEngine.queueSpeechText(text, decodedBuffer.duration);
    source.start(0);
  }

  private playSpeechSynthesisFallback(text: string, signal: AbortSignal): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setTimeout(
        () => this.handleSpeechCompleted(),
        Math.max(2000, text.split(" ").length * 350)
      );
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find(
        (v) =>
          v.name.includes("Jenny") ||
          (v.lang.startsWith("en") && v.name.includes("Female"))
      ) || voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      if (!signal.aborted) {
        this.isSpeakingActive = true;
        const estDuration = Math.max(1.5, text.split(" ").length * 0.35);
        this.visemeEngine.queueSpeechText(text, estDuration);
      }
    };

    utterance.onend = () => {
      if (!signal.aborted) {
        this.handleSpeechCompleted();
      }
    };

    utterance.onerror = () => {
      if (!signal.aborted) {
        this.handleSpeechCompleted();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  private handleSpeechCompleted(): void {
    this.isSpeakingActive = false;
    this.stopSpeaking();
    this.setState("LISTENING");
    const onEnd = this.currentSpeechOnEnd;
    this.currentSpeechOnEnd = null;
    if (onEnd) {
      onEnd();
    }
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
    this.visemeEngine.clear();
    this.currentViseme = "sil";
    this.visemeIntensity = 0;
    this.currentAudioEnergy = 0;
    this.gestureType = "RESTING_DESK";
    this.gestureProgress = 1.0;

    // Immediately reset speech morphs to neutral
    const visemeKeys = [
      "aa_02",
      "aa_ah_ax_01",
      "ao_03",
      "aw_09",
      "ay_11",
      "d_t_n_19",
      "er_05",
      "ey_eh_uh_04",
      "f_v_18",
      "h_12",
      "k_g_ng_20",
      "l_14",
      "ow_08",
      "oy_10",
      "p_b_m_21",
      "r_13",
      "sh_ch_jh_zh_16",
      "sil_00",
      "s_z_15",
      "th_dh_17",
      "w_uw_07",
      "y_iy_ih_ix_06",
      "jawOpen",
      "mouthClose",
    ];
    for (const key of visemeKeys) {
      this.setTargetMorph(key, key === "sil_00" ? 1.0 : 0.0);
    }
  }

  public resize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --- Main Animation Loop ---

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    this.updateIdleBreathing(elapsedTime);
    this.updateHeadAndNeck(delta, elapsedTime);
    this.updateEyeMovement(delta, elapsedTime);
    this.updateBlinking(delta, elapsedTime);
    this.updateLipSync(delta);
    this.updateFacialExpressions();
    this.updateHandGestures(delta, elapsedTime);
    this.flushMorphTargets(delta);

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private updateIdleBreathing(time: number) {
    if (!this.bones.spine03 || !this.restRotations.has("spine_03")) return;

    const breath = Math.sin(time * 1.45) * 0.008;
    const rest = this.restRotations.get("spine03") || this.restRotations.get("spine_03")!;
    this.bones.spine03.rotation.x = rest.x + breath;

    if (this.bones.spine02 && this.restRotations.has("spine_02")) {
      const rest2 = this.restRotations.get("spine_02")!;
      this.bones.spine02.rotation.x = rest2.x + breath * 0.5;
    }
  }

  private updateHeadAndNeck(delta: number, time: number) {
    if (!this.bones.head || !this.restRotations.has("head")) return;

    const ambientX = Math.sin(time * 0.9) * 0.010;
    const ambientY = Math.cos(time * 0.7) * 0.012;
    const ambientZ = Math.sin(time * 0.5) * 0.006;

    let nodOffset = 0;
    if (this.isNodding) {
      this.nodProgress += delta * 4.0;
      nodOffset = Math.sin(this.nodProgress * Math.PI) * this.nodIntensity;
      if (this.nodProgress >= 1.0) {
        this.isNodding = false;
        this.nodProgress = 0;
      }
    }

    if (this.currentState === "LISTENING" && time > this.nextListenNodTime) {
      this.triggerNod(0.065);
      this.nextListenNodTime = time + 5.0 + Math.random() * 4.0;
    }

    const lerpRate = 5.0;
    this.headCurrentRot.x +=
      (this.headTargetRot.x + ambientX + nodOffset - this.headCurrentRot.x) *
      Math.min(1, delta * lerpRate);
    this.headCurrentRot.y +=
      (this.headTargetRot.y + ambientY - this.headCurrentRot.y) *
      Math.min(1, delta * lerpRate);
    this.headCurrentRot.z +=
      (this.headTargetRot.z + ambientZ - this.headCurrentRot.z) *
      Math.min(1, delta * lerpRate);

    const headRest = this.restRotations.get("head")!;
    this.bones.head.rotation.set(
      headRest.x + this.headCurrentRot.x,
      headRest.y + this.headCurrentRot.y,
      headRest.z + this.headCurrentRot.z
    );

    if (this.bones.neck && this.restRotations.has("neck_01")) {
      const neckRest = this.restRotations.get("neck_01")!;
      this.bones.neck.rotation.set(
        neckRest.x + this.headCurrentRot.x * 0.35,
        neckRest.y + this.headCurrentRot.y * 0.35,
        neckRest.z + this.headCurrentRot.z * 0.35
      );
    }
  }

  private updateEyeMovement(delta: number, time: number) {
    if (time > this.nextSaccadeTime) {
      if (this.currentState !== "THINKING") {
        const saccadeX = (Math.random() - 0.5) * 0.05;
        const saccadeY = (Math.random() - 0.5) * 0.04;
        this.gazeTarget.x = this.candidateGaze.x * 0.22 + saccadeX;
        this.gazeTarget.y = this.candidateGaze.y * 0.16 + saccadeY;
      }
      this.nextSaccadeTime = time + 1.8 + Math.random() * 2.2;
    }

    const gazeLerpRate = 12.0;
    this.gazeCurrent.x +=
      (this.gazeTarget.x - this.gazeCurrent.x) * Math.min(1, delta * gazeLerpRate);
    this.gazeCurrent.y +=
      (this.gazeTarget.y - this.gazeCurrent.y) * Math.min(1, delta * gazeLerpRate);

    const gx = this.gazeCurrent.x;
    const gy = this.gazeCurrent.y;

    if (gx > 0) {
      this.setTargetMorph("eyeLookOutLeft", Math.min(1.0, gx * 2.5));
      this.setTargetMorph("eyeLookInRight", Math.min(1.0, gx * 2.5));
      this.setTargetMorph("eyeLookInLeft", 0);
      this.setTargetMorph("eyeLookOutRight", 0);
    } else {
      this.setTargetMorph("eyeLookInLeft", Math.min(1.0, -gx * 2.5));
      this.setTargetMorph("eyeLookOutRight", Math.min(1.0, -gx * 2.5));
      this.setTargetMorph("eyeLookOutLeft", 0);
      this.setTargetMorph("eyeLookInRight", 0);
    }

    if (gy > 0) {
      this.setTargetMorph("eyeLookUpLeft", Math.min(1.0, gy * 2.5));
      this.setTargetMorph("eyeLookUpRight", Math.min(1.0, gy * 2.5));
      this.setTargetMorph("eyeLookDownLeft", 0);
      this.setTargetMorph("eyeLookDownRight", 0);
    } else {
      this.setTargetMorph("eyeLookDownLeft", Math.min(1.0, -gy * 2.5));
      this.setTargetMorph("eyeLookDownRight", Math.min(1.0, -gy * 2.5));
      this.setTargetMorph("eyeLookUpLeft", 0);
      this.setTargetMorph("eyeLookUpRight", 0);
    }
  }

  private updateBlinking(delta: number, time: number) {
    if (!this.isBlinking && time > this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.isDoubleBlink = Math.random() < 0.16;
      this.doubleBlinkCount = 0;
      this.blinkDuration = 0.10 + Math.random() * 0.05;
      this.nextBlinkTime = time + 2.5 + Math.random() * 3.5;
    }

    if (this.isBlinking) {
      this.blinkProgress += delta / this.blinkDuration;
      let blinkWeight = 0;

      if (this.blinkProgress < 0.5) {
        blinkWeight = this.blinkProgress / 0.5;
      } else if (this.blinkProgress < 1.0) {
        blinkWeight = 1.0 - (this.blinkProgress - 0.5) / 0.5;
      } else {
        if (this.isDoubleBlink && this.doubleBlinkCount === 0) {
          this.doubleBlinkCount = 1;
          this.blinkProgress = 0;
          this.blinkDuration = 0.08;
          blinkWeight = 0;
        } else {
          this.isBlinking = false;
          this.isDoubleBlink = false;
          blinkWeight = 0;
        }
      }

      this.setTargetMorph("eyeBlinkLeft", blinkWeight);
      this.setTargetMorph("eyeBlinkRight", blinkWeight);
    } else {
      this.setTargetMorph("eyeBlinkLeft", 0);
      this.setTargetMorph("eyeBlinkRight", 0);
    }
  }

  private updateLipSync(delta: number) {
    const visemeKeys = [
      "aa_02",
      "aa_ah_ax_01",
      "ao_03",
      "aw_09",
      "ay_11",
      "d_t_n_19",
      "er_05",
      "ey_eh_uh_04",
      "f_v_18",
      "h_12",
      "k_g_ng_20",
      "l_14",
      "ow_08",
      "oy_10",
      "p_b_m_21",
      "r_13",
      "sh_ch_jh_zh_16",
      "sil_00",
      "s_z_15",
      "th_dh_17",
      "w_uw_07",
      "y_iy_ih_ix_06",
      "jawOpen",
      "mouthClose",
    ];

    // Absolute Audio Rule: If not speaking, strictly neutral mouth
    if (!this.isSpeakingActive) {
      for (const key of visemeKeys) {
        this.setTargetMorph(key, key === "sil_00" ? 1.0 : 0.0);
      }
      return;
    }

    // Measure real-time audio energy
    let audioEnergy = 0;
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.audioFrequencyData as any);
      let sum = 0;
      for (let i = 0; i < this.audioFrequencyData.length; i++) {
        sum += this.audioFrequencyData[i];
      }
      const avg = sum / this.audioFrequencyData.length;
      audioEnergy = Math.min(1.5, (avg / 128) * 1.8);
    } else {
      audioEnergy = 0.8 + Math.sin(this.clock.getElapsedTime() * 11) * 0.4;
    }

    this.currentAudioEnergy +=
      (audioEnergy - this.currentAudioEnergy) * Math.min(1, delta * 15.0);

    const { intensity, viseme } = this.visemeEngine.update(delta);
    const effectiveIntensity = Math.min(
      1.0,
      intensity * Math.max(0.2, this.currentAudioEnergy)
    );

    for (const key of visemeKeys) {
      this.setTargetMorph(key, 0);
    }

    if (effectiveIntensity > 0.05) {
      switch (viseme) {
        case "aa":
          this.setTargetMorph("aa_02", 0.75 * effectiveIntensity);
          this.setTargetMorph("aa_ah_ax_01", 0.55 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.35 * effectiveIntensity);
          break;
        case "oh":
          this.setTargetMorph("ow_08", 0.70 * effectiveIntensity);
          this.setTargetMorph("ao_03", 0.60 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.28 * effectiveIntensity);
          break;
        case "ou":
          this.setTargetMorph("w_uw_07", 0.85 * effectiveIntensity);
          this.setTargetMorph("mouthPucker", 0.35 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.18 * effectiveIntensity);
          break;
        case "ee":
          this.setTargetMorph("y_iy_ih_ix_06", 0.80 * effectiveIntensity);
          this.setTargetMorph("mouthStretchLeft", 0.30 * effectiveIntensity);
          this.setTargetMorph("mouthStretchRight", 0.30 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.15 * effectiveIntensity);
          break;
        case "ih":
          this.setTargetMorph("ey_eh_uh_04", 0.65 * effectiveIntensity);
          this.setTargetMorph("y_iy_ih_ix_06", 0.45 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.20 * effectiveIntensity);
          break;
        case "mbp":
          this.setTargetMorph("p_b_m_21", 0.90 * effectiveIntensity);
          this.setTargetMorph("mouthClose", 0.40 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.02);
          break;
        case "fv":
          this.setTargetMorph("f_v_18", 0.85 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.12 * effectiveIntensity);
          break;
        case "th":
          this.setTargetMorph("th_dh_17", 0.85 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.18 * effectiveIntensity);
          break;
        case "sz":
          this.setTargetMorph("s_z_15", 0.75 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.12 * effectiveIntensity);
          break;
        case "sh":
          this.setTargetMorph("sh_ch_jh_zh_16", 0.85 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.14 * effectiveIntensity);
          break;
        case "kg":
          this.setTargetMorph("k_g_ng_20", 0.75 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.25 * effectiveIntensity);
          break;
        default:
          this.setTargetMorph("sil_00", 1.0);
          break;
      }
    } else {
      this.setTargetMorph("sil_00", 1.0);
    }
  }

  private updateFacialExpressions() {
    const weight = this.expressionWeight;

    const exprKeys = [
      "mouthSmileLeft",
      "mouthSmileRight",
      "browInnerUp",
      "browOuterUpLeft",
      "browOuterUpRight",
      "browDownLeft",
      "browDownRight",
      "cheekSquintLeft",
      "cheekSquintRight",
    ];
    for (const k of exprKeys) {
      this.setTargetMorph(k, 0);
    }

    switch (this.currentExpression) {
      case "WARM_SMILE":
        this.setTargetMorph("mouthSmileLeft", 0.55 * weight);
        this.setTargetMorph("mouthSmileRight", 0.55 * weight);
        this.setTargetMorph("cheekSquintLeft", 0.25 * weight);
        this.setTargetMorph("cheekSquintRight", 0.25 * weight);
        break;
      case "ENCOURAGING":
        this.setTargetMorph("mouthSmileLeft", 0.40 * weight);
        this.setTargetMorph("mouthSmileRight", 0.40 * weight);
        this.setTargetMorph("browInnerUp", 0.20 * weight);
        break;
      case "THINKING":
        this.setTargetMorph("browInnerUp", 0.35 * weight);
        this.setTargetMorph("browOuterUpLeft", 0.25 * weight);
        break;
      case "CONCERNED":
        this.setTargetMorph("browInnerUp", 0.30 * weight);
        this.setTargetMorph("browDownLeft", 0.18 * weight);
        this.setTargetMorph("browDownRight", 0.18 * weight);
        break;
      case "INTERESTED":
      case "LISTENING":
        this.setTargetMorph("mouthSmileLeft", 0.12 * weight);
        this.setTargetMorph("mouthSmileRight", 0.12 * weight);
        this.setTargetMorph("browInnerUp", 0.10 * weight);
        break;
      default:
        this.setTargetMorph("mouthSmileLeft", 0.08);
        this.setTargetMorph("mouthSmileRight", 0.08);
        break;
    }
  }

  private updateHandGestures(delta: number, time: number) {
    if (!this.bones.upperarmR || !this.bones.lowerarmR || !this.bones.handR) return;
    if (!this.bones.upperarmL || !this.bones.lowerarmL || !this.bones.handL) return;
    if (!this.restRotations.has("upperarm_r") || !this.restRotations.has("lowerarm_r")) return;
    if (!this.restRotations.has("upperarm_l") || !this.restRotations.has("lowerarm_l")) return;

    const rUpperRest = this.restRotations.get("upperarm_r")!;
    const rLowerRest = this.restRotations.get("lowerarm_r")!;
    const lUpperRest = this.restRotations.get("upperarm_l")!;
    const lLowerRest = this.restRotations.get("lowerarm_l")!;

    // Base resting pose (seated desk rest: arms forward, forearms flexed forward +52° onto desk)
    const baseRUpperX = rUpperRest.x + 0.31;
    const baseRUpperY = rUpperRest.y - 0.17;
    const baseRUpperZ = rUpperRest.z + 0.26;
    const baseRLowerX = rLowerRest.x + 0.91;
    const baseRLowerZ = rLowerRest.z;

    const baseLUpperX = lUpperRest.x + 0.31;
    const baseLUpperY = lUpperRest.y + 0.17;
    const baseLUpperZ = lUpperRest.z - 0.26;
    const baseLLowerX = lLowerRest.x + 0.91;
    const baseLLowerZ = lLowerRest.z;

    if (this.gestureProgress < 1.0) {
      this.gestureProgress += delta / this.gestureDuration;
      const p = Math.min(1.0, this.gestureProgress);
      // Bell-curve arc guaranteed to smoothly return to 0 at end
      const arc = Math.sin(p * Math.PI);

      switch (this.gestureType) {
        case "SPEAKING_EMPHASIS_RIGHT": {
          const lift = arc * 0.20;
          this.bones.upperarmR.rotation.x = baseRUpperX + lift * 0.12;
          this.bones.upperarmR.rotation.y = baseRUpperY - lift * 0.10;
          this.bones.upperarmR.rotation.z = baseRUpperZ - lift * 0.12;
          this.bones.lowerarmR.rotation.x = baseRLowerX + lift * 0.20;
          this.bones.handR.rotation.y = arc * 0.20;
          break;
        }
        case "EXPLAINING_OPEN_PALMS": {
          const lift = arc * 0.18;
          this.bones.upperarmR.rotation.x = baseRUpperX + lift * 0.12;
          this.bones.upperarmR.rotation.z = baseRUpperZ - lift * 0.12;
          this.bones.lowerarmR.rotation.x = baseRLowerX + lift * 0.18;
          this.bones.handR.rotation.y = arc * 0.20;

          this.bones.upperarmL.rotation.x = baseLUpperX + lift * 0.12;
          this.bones.upperarmL.rotation.z = baseLUpperZ + lift * 0.12;
          this.bones.lowerarmL.rotation.x = baseLLowerX + lift * 0.18;
          this.bones.handL.rotation.y = -arc * 0.20;
          break;
        }
        case "THINKING_TILT": {
          const lift = arc * 0.10;
          this.bones.upperarmR.rotation.x = baseRUpperX + lift * 0.08;
          this.bones.lowerarmR.rotation.x = baseRLowerX + lift * 0.12;
          break;
        }
        case "NOD_ENCOURAGING": {
          const lift = arc * 0.08;
          this.bones.upperarmR.rotation.x = baseRUpperX + lift * 0.06;
          this.bones.lowerarmR.rotation.x = baseRLowerX + lift * 0.10;
          break;
        }
        default:
          break;
      }
    } else {
      const returnRate = 4.0;
      this.bones.upperarmR.rotation.x +=
        (baseRUpperX - this.bones.upperarmR.rotation.x) * Math.min(1, delta * returnRate);
      this.bones.upperarmR.rotation.y +=
        (baseRUpperY - this.bones.upperarmR.rotation.y) * Math.min(1, delta * returnRate);
      this.bones.upperarmR.rotation.z +=
        (baseRUpperZ - this.bones.upperarmR.rotation.z) * Math.min(1, delta * returnRate);
      this.bones.lowerarmR.rotation.x +=
        (baseRLowerX - this.bones.lowerarmR.rotation.x) * Math.min(1, delta * returnRate);
      this.bones.lowerarmR.rotation.z +=
        (baseRLowerZ - this.bones.lowerarmR.rotation.z) * Math.min(1, delta * returnRate);
      this.bones.handR.rotation.y +=
        (0 - this.bones.handR.rotation.y) * Math.min(1, delta * returnRate);

      this.bones.upperarmL.rotation.x +=
        (baseLUpperX - this.bones.upperarmL.rotation.x) * Math.min(1, delta * returnRate);
      this.bones.upperarmL.rotation.y +=
        (baseLUpperY - this.bones.upperarmL.rotation.y) * Math.min(1, delta * returnRate);
      this.bones.upperarmL.rotation.z +=
        (baseLUpperZ - this.bones.upperarmL.rotation.z) * Math.min(1, delta * returnRate);
      this.bones.lowerarmL.rotation.x +=
        (baseLLowerX - this.bones.lowerarmL.rotation.x) * Math.min(1, delta * returnRate);
      this.bones.lowerarmL.rotation.z +=
        (baseLLowerZ - this.bones.lowerarmL.rotation.z) * Math.min(1, delta * returnRate);
      this.bones.handL.rotation.y +=
        (0 - this.bones.handL.rotation.y) * Math.min(1, delta * returnRate);
    }
  }

  private flushMorphTargets(delta: number) {
    if (!this.morphMesh || !this.morphInfluences) return;

    const lerpSpeed = 22.0;

    this.targetMorphValues.forEach((targetVal, name) => {
      const idx = this.morphDictionary[name];
      if (idx === undefined) return;

      const currentVal = this.activeMorphValues.get(name) || 0;
      const nextVal = currentVal + (targetVal - currentVal) * Math.min(1.0, delta * lerpSpeed);

      this.activeMorphValues.set(name, nextVal);
      this.morphInfluences[idx] = nextVal;
    });
  }

  public dispose(): void {
    this.stopSpeaking();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.sarahModel = null;
    this.morphMesh = null;
    this.isInitialized = false;
  }
}
