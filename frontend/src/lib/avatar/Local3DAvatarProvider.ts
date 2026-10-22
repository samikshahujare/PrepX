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
  fingerBonesL: Map<string, THREE.Bone>;
  fingerBonesR: Map<string, THREE.Bone>;
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
    fingerBonesL: new Map(),
    fingerBonesR: new Map(),
  };
  private restRotations: Map<string, THREE.Euler> = new Map();

  // Real GLB SkinnedMesh & Morph Targets
  private morphMesh: THREE.SkinnedMesh | null = null;
  private morphMeshes: THREE.SkinnedMesh[] = [];
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
  private getApiBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
    }
    if (typeof window !== "undefined") {
      const { hostname, protocol } = window.location;
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `${protocol}//${hostname}:8000/api/v1`;
      }
    }
    return "http://localhost:8000/api/v1";
  }
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

    // 4. Perspective Camera calibrated for full upper-body seated portrait framing with hands on desk
    const aspect = width / height;
    const initialFov = aspect < 1.15 ? Math.min(38, 31 * (1.15 / Math.max(0.75, aspect))) : 31;
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 30);
    this.camera.position.set(0, 0.02, 1.84);
    this.camera.lookAt(0, -0.08, 0);

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

    const ambientLight = new THREE.AmbientLight(0xf8f9fa, 0.65);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.05);
    keyLight.position.set(0.8, 1.8, 2.0);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0fa, 0.55);
    fillLight.position.set(-1.0, 1.4, 1.6);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf1f5f9, 0.70);
    rimLight.position.set(0.2, 1.8, -1.6);
    this.scene.add(rimLight);

    const deskBounce = new THREE.PointLight(0xfef3c7, 0.35, 3);
    deskBounce.position.set(0, -0.30, 0.8);
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
    const deskGeo = new THREE.BoxGeometry(4.0, 0.74, 1.2);
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
    deskMesh.position.set(0, -0.64, 0.42);
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

    notebookGroup.position.set(0.55, -0.25, 0.45);
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
    pen.position.set(0.52, -0.225, 0.43);
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

          // 1. Texture Loader for enhanced skin & photorealistic iris
          const textureLoader = new THREE.TextureLoader();
          const enhancedSkinMap = textureLoader.load("/avatars/sarah_skin_diffuse_enhanced.png");
          enhancedSkinMap.flipY = false;
          enhancedSkinMap.colorSpace = THREE.SRGBColorSpace;

          const eyeIrisMap = textureLoader.load("/avatars/sarah_eye_iris.png");
          eyeIrisMap.flipY = false;
          eyeIrisMap.colorSpace = THREE.SRGBColorSpace;

          // 2. Identify Skeleton Bones & Apply Materials
          this.sarahModel.traverse((child) => {
            // Keep all rigged features visible (eyebrows, eyelashes, earrings, ponytail)
            if (
              child.name.includes("mindfront_eyebrows") ||
              child.name.includes("mindfront_eyelashes") ||
              child.name.includes("mind_eyebrows") ||
              child.name.includes("mind_eyelashes")
            ) {
              child.visible = true;
            }

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
                default:
                  // Track individual finger joints for natural hand poses
                  if (
                    name.startsWith("index_") ||
                    name.startsWith("middle_") ||
                    name.startsWith("ring_") ||
                    name.startsWith("pinky_") ||
                    name.startsWith("thumb_")
                  ) {
                    if (name.endsWith("_l")) {
                      this.bones.fingerBonesL.set(name, bone);
                    } else if (name.endsWith("_r")) {
                      this.bones.fingerBonesR.set(name, bone);
                    }
                  }
                  break;
              }
            }

            // 3. Identify SkinnedMesh with Morph Targets & Refine Materials
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.frustumCulled = false;

              if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
                const sMesh = mesh as THREE.SkinnedMesh;
                if (
                  sMesh.morphTargetDictionary &&
                  sMesh.morphTargetInfluences &&
                  Object.keys(sMesh.morphTargetDictionary).length > 0
                ) {
                  this.morphMeshes.push(sMesh);
                  if (!this.morphMesh) {
                    this.morphMesh = sMesh;
                    this.morphInfluences = sMesh.morphTargetInfluences;
                  }
                  Object.assign(this.morphDictionary, sMesh.morphTargetDictionary);
                  console.info(
                    `[Local3DAvatarProvider] Bound morph mesh: ${sMesh.name || "unnamed"} with ${Object.keys(sMesh.morphTargetDictionary).length} morph targets (total bound meshes: ${this.morphMeshes.length})`
                  );
                }
              }

              // Apply Refined Professional Aesthetics to Materials
              const materials = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];

              materials.forEach((m) => {
                if (!m) return;
                const mat = m as THREE.MeshStandardMaterial;

                if (mat.name === "Sarah_Skin_PBR" || mat.name === "Sarah_Skin") {
                  mat.map = enhancedSkinMap;
                  mat.roughness = 0.54;
                  mat.metalness = 0.02;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Eye_Iris") {
                  mat.map = null;
                  mat.color = new THREE.Color(0x3a2216); // Warm chocolate hazel
                  mat.roughness = 0.08;
                  mat.metalness = 0.0;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Eye_Pupil") {
                  mat.color = new THREE.Color(0x050505);
                  mat.roughness = 0.05;
                  mat.metalness = 0.0;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Eye_Sclera") {
                  mat.color = new THREE.Color(0xf6f4f0);
                  mat.roughness = 0.20;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Eyebrows_PBR") {
                  mat.color = new THREE.Color(0x1a0f0a);
                  mat.roughness = 0.45;
                  mat.metalness = 0.0;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Eyelashes_PBR") {
                  mat.color = new THREE.Color(0x0f0b08);
                  mat.roughness = 0.35;
                  mat.metalness = 0.0;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Navy_Blazer") {
                  mat.color = new THREE.Color(0x192536);
                  mat.roughness = 0.72;
                  mat.metalness = 0.04;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Cream_Blouse") {
                  mat.color = new THREE.Color(0xf4efe7);
                  mat.roughness = 0.65;
                  mat.metalness = 0.0;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Gold_PBR") {
                  mat.color = new THREE.Color(0xdeb862);
                  mat.roughness = 0.20;
                  mat.metalness = 0.85;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Hair_PBR") {
                  mat.color = new THREE.Color(0x231610);
                  mat.roughness = 0.44;
                  mat.metalness = 0.06;
                  mat.needsUpdate = true;
                } else if (mat.name === "Sarah_Teeth_PBR") {
                  mat.color = new THREE.Color(0xf4f1ea);
                  mat.roughness = 0.35;
                  mat.needsUpdate = true;
                }
              });
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
    const DESK_REST_QUATS = {
      upperarm_l: new THREE.Quaternion(0.15971, 0.04263, -0.46501, 0.86973),
      lowerarm_l: new THREE.Quaternion(0.69479, 0.04135, -0.27518, 0.66320),
      hand_l:     new THREE.Quaternion(0.07527, 0.39813,  0.07505, 0.91115),
      upperarm_r: new THREE.Quaternion(0.15971, -0.04263, 0.46501, 0.86973),
      lowerarm_r: new THREE.Quaternion(0.69479, -0.04135, 0.27518, 0.66320),
      hand_r:     new THREE.Quaternion(0.07527, -0.39813, -0.07505, 0.91115),
    };

    if (this.bones.upperarmL) this.bones.upperarmL.quaternion.copy(DESK_REST_QUATS.upperarm_l);
    if (this.bones.lowerarmL) this.bones.lowerarmL.quaternion.copy(DESK_REST_QUATS.lowerarm_l);
    if (this.bones.handL)     this.bones.handL.quaternion.copy(DESK_REST_QUATS.hand_l);
    if (this.bones.upperarmR) this.bones.upperarmR.quaternion.copy(DESK_REST_QUATS.upperarm_r);
    if (this.bones.lowerarmR) this.bones.lowerarmR.quaternion.copy(DESK_REST_QUATS.lowerarm_r);
    if (this.bones.handR)     this.bones.handR.quaternion.copy(DESK_REST_QUATS.hand_r);

    const FINGER_REST_QUATS: Record<string, [number, number, number, number]> = {
      "index_01_l": [0.23927, 0.47453, -0.03518, 0.84637],
      "index_01_r": [0.23927, -0.47453, 0.03518, 0.84637],
      "index_02_l": [0.29635, 0.00401, 0.00548, 0.95505],
      "index_02_r": [0.29635, -0.00401, -0.00548, 0.95505],
      "index_03_l": [0.21805, 0.00356, 0.01834, 0.97576],
      "index_03_r": [0.21805, -0.00356, -0.01834, 0.97576],
      "middle_01_l": [0.2287, 0.39013, -0.17355, 0.87486],
      "middle_01_r": [0.2287, -0.39013, 0.17355, 0.87486],
      "middle_02_l": [0.23646, 0.00751, 0.0359, 0.97095],
      "middle_02_r": [0.23646, -0.00751, -0.0359, 0.97095],
      "middle_03_l": [0.22292, -1e-05, -0.00592, 0.97482],
      "middle_03_r": [0.22292, 1e-05, 0.00592, 0.97482],
      "pinky_01_l": [0.17594, 0.25237, -0.30709, 0.90058],
      "pinky_01_r": [0.17594, -0.25237, 0.30709, 0.90058],
      "pinky_02_l": [0.26957, 0.00578, 0.02394, 0.96266],
      "pinky_02_r": [0.26957, -0.00578, -0.02394, 0.96266],
      "pinky_03_l": [0.1478, -0.002, -0.01115, 0.98895],
      "pinky_03_r": [0.1478, 0.002, 0.01115, 0.98895],
      "ring_01_l": [0.18232, 0.35818, -0.24812, 0.88142],
      "ring_01_r": [0.18232, -0.35818, 0.24812, 0.88142],
      "ring_02_l": [0.24872, 0.00857, 0.04229, 0.96761],
      "ring_02_r": [0.24872, -0.00857, -0.04229, 0.96761],
      "ring_03_l": [0.215, -0.00316, -0.02434, 0.97631],
      "ring_03_r": [0.215, 0.00316, 0.02434, 0.97631],
      "thumb_01_l": [0.42501, 0.6938, 0.37788, 0.44183],
      "thumb_01_r": [0.42501, -0.6938, -0.37788, 0.44183],
      "thumb_02_l": [0.19638, -0.04083, -0.1791, 0.96317],
      "thumb_02_r": [0.19638, 0.04083, 0.1791, 0.96317],
      "thumb_03_l": [0.14205, -0.00692, -0.03281, 0.98929],
      "thumb_03_r": [0.14205, 0.00692, 0.03281, 0.98929],
    };
    for (const [name, q] of Object.entries(FINGER_REST_QUATS)) {
      const bone = this.bones.fingerBonesL.get(name) || this.bones.fingerBonesR.get(name);
      if (bone) {
        bone.quaternion.set(q[0], q[1], q[2], q[3]);
      }
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
      const response = await fetch(`${this.getApiBaseUrl()}/avatar/tts`, {
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
      "mouthFunnel",
      "mouthPucker",
      "mouthLowerDownLeft",
      "mouthLowerDownRight",
      "mouthUpperUpLeft",
      "mouthUpperUpRight",
      "mouthStretchLeft",
      "mouthStretchRight",
      "mouthRollLower",
      "mouthRollUpper",
    ];
    for (const key of visemeKeys) {
      this.setTargetMorph(key, key === "sil_00" ? 1.0 : 0.0);
    }
  }

  public resize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Responsive framing: dynamically expand vertical FOV on narrower aspect ratios to prevent shoulder/hand clipping
    if (aspect < 1.15) {
      this.camera.fov = Math.min(38, 31 * (1.15 / Math.max(0.75, aspect)));
    } else {
      this.camera.fov = 31;
    }
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

    // Periodic listening nod disabled to prevent continuous unrequested head movements

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

    // Natural warm eyelid relaxation to prevent staring/scary look
    this.setTargetMorph("eyeSquintLeft", 0.05);
    this.setTargetMorph("eyeSquintRight", 0.05);
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
      "mouthFunnel",
      "mouthPucker",
      "mouthLowerDownLeft",
      "mouthLowerDownRight",
      "mouthUpperUpLeft",
      "mouthUpperUpRight",
      "mouthStretchLeft",
      "mouthStretchRight",
      "mouthRollLower",
      "mouthRollUpper",
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
      audioEnergy = Math.min(1.8, (avg / 44) * 1.5);
    } else {
      audioEnergy = 0.8 + Math.sin(this.clock.getElapsedTime() * 11) * 0.4;
    }

    this.currentAudioEnergy +=
      (audioEnergy - this.currentAudioEnergy) * Math.min(1, delta * 15.0);

    const { intensity, viseme } = this.visemeEngine.update(delta);
    const speechClock = this.clock.getElapsedTime();
    const rhythmWave = Math.sin(speechClock * 13.0) * 0.5 + 0.5;
    const audioDrive = Math.max(0.35, Math.min(1.5, this.currentAudioEnergy));
    const effectiveIntensity = Math.min(
      1.0,
      Math.max(0.40, intensity) * audioDrive
    );

    for (const key of visemeKeys) {
      this.setTargetMorph(key, 0);
    }

    if (effectiveIntensity > 0.05 && viseme !== "sil") {
      switch (viseme) {
        case "aa":
          this.setTargetMorph("aa_02", 0.85 * effectiveIntensity);
          this.setTargetMorph("aa_ah_ax_01", 0.65 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.65 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownLeft", 0.40 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownRight", 0.40 * effectiveIntensity);
          this.setTargetMorph("mouthUpperUpLeft", 0.25 * effectiveIntensity);
          this.setTargetMorph("mouthUpperUpRight", 0.25 * effectiveIntensity);
          break;
        case "oh":
          this.setTargetMorph("ow_08", 0.80 * effectiveIntensity);
          this.setTargetMorph("ao_03", 0.70 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.50 * effectiveIntensity);
          this.setTargetMorph("mouthFunnel", 0.60 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownLeft", 0.25 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownRight", 0.25 * effectiveIntensity);
          break;
        case "ou":
          this.setTargetMorph("w_uw_07", 0.90 * effectiveIntensity);
          this.setTargetMorph("mouthPucker", 0.55 * effectiveIntensity);
          this.setTargetMorph("mouthFunnel", 0.45 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.35 * effectiveIntensity);
          break;
        case "ee":
          this.setTargetMorph("y_iy_ih_ix_06", 0.85 * effectiveIntensity);
          this.setTargetMorph("mouthStretchLeft", 0.45 * effectiveIntensity);
          this.setTargetMorph("mouthStretchRight", 0.45 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownLeft", 0.15 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownRight", 0.15 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.28 * effectiveIntensity);
          break;
        case "ih":
          this.setTargetMorph("ey_eh_uh_04", 0.75 * effectiveIntensity);
          this.setTargetMorph("y_iy_ih_ix_06", 0.50 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownLeft", 0.20 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownRight", 0.20 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.35 * effectiveIntensity);
          break;
        case "mbp":
          this.setTargetMorph("p_b_m_21", 0.95 * effectiveIntensity);
          this.setTargetMorph("mouthClose", 0.85 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.02);
          break;
        case "fv":
          this.setTargetMorph("f_v_18", 0.85 * effectiveIntensity);
          this.setTargetMorph("mouthRollLower", 0.30 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.18 * effectiveIntensity);
          break;
        case "th":
          this.setTargetMorph("th_dh_17", 0.85 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownLeft", 0.15 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownRight", 0.15 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.25 * effectiveIntensity);
          break;
        case "sz":
          this.setTargetMorph("s_z_15", 0.80 * effectiveIntensity);
          this.setTargetMorph("mouthStretchLeft", 0.25 * effectiveIntensity);
          this.setTargetMorph("mouthStretchRight", 0.25 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.16 * effectiveIntensity);
          break;
        case "sh":
          this.setTargetMorph("sh_ch_jh_zh_16", 0.85 * effectiveIntensity);
          this.setTargetMorph("mouthPucker", 0.25 * effectiveIntensity);
          this.setTargetMorph("mouthFunnel", 0.25 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.22 * effectiveIntensity);
          break;
        case "kg":
          this.setTargetMorph("k_g_ng_20", 0.80 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownLeft", 0.20 * effectiveIntensity);
          this.setTargetMorph("mouthLowerDownRight", 0.20 * effectiveIntensity);
          this.setTargetMorph("jawOpen", 0.35 * effectiveIntensity);
          break;
        default:
          if (this.currentAudioEnergy > 0.08) {
            const fallbackJaw = Math.min(0.60, this.currentAudioEnergy * 0.50 * (0.55 + rhythmWave * 0.45));
            this.setTargetMorph("jawOpen", fallbackJaw);
            this.setTargetMorph("mouthLowerDownLeft", fallbackJaw * 0.45);
            this.setTargetMorph("mouthLowerDownRight", fallbackJaw * 0.45);
            this.setTargetMorph("mouthUpperUpLeft", fallbackJaw * 0.25);
            this.setTargetMorph("mouthUpperUpRight", fallbackJaw * 0.25);
            this.setTargetMorph("aa_02", fallbackJaw * 0.40);
          } else {
            this.setTargetMorph("sil_00", 1.0);
          }
          break;
      }
    } else if (this.isSpeakingActive && this.currentAudioEnergy > 0.08) {
      // Audio-driven articulation during speech when viseme queue has gap or ended
      const fallbackJaw = Math.min(0.58, this.currentAudioEnergy * 0.48 * (0.55 + rhythmWave * 0.45));
      this.setTargetMorph("jawOpen", fallbackJaw);
      this.setTargetMorph("mouthLowerDownLeft", fallbackJaw * 0.40);
      this.setTargetMorph("mouthLowerDownRight", fallbackJaw * 0.40);
      this.setTargetMorph("mouthUpperUpLeft", fallbackJaw * 0.20);
      this.setTargetMorph("mouthUpperUpRight", fallbackJaw * 0.20);
      this.setTargetMorph("aa_02", fallbackJaw * 0.35);
    } else {
      this.setTargetMorph("sil_00", 1.0);
    }
  }

  private updateFacialExpressions() {
    // When actively speaking, attenuate smile weight to 0.30 so the smile adds warmth without locking mouth closed
    const weight = this.isSpeakingActive ? this.expressionWeight * 0.30 : this.expressionWeight;

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
        this.setTargetMorph("mouthSmileLeft", 0.08 * weight);
        this.setTargetMorph("mouthSmileRight", 0.08 * weight);
        break;
    }
  }

  private updateHandGestures(delta: number, time: number) {
    if (!this.bones.upperarmR || !this.bones.lowerarmR || !this.bones.handR) return;
    if (!this.bones.upperarmL || !this.bones.lowerarmL || !this.bones.handL) return;

    const DESK_REST_QUATS = {
      upperarm_l: new THREE.Quaternion(0.15971, 0.04263, -0.46501, 0.86973),
      lowerarm_l: new THREE.Quaternion(0.69479, 0.04135, -0.27518, 0.66320),
      hand_l:     new THREE.Quaternion(0.07527, 0.39813,  0.07505, 0.91115),
      upperarm_r: new THREE.Quaternion(0.15971, -0.04263, 0.46501, 0.86973),
      lowerarm_r: new THREE.Quaternion(0.69479, -0.04135, 0.27518, 0.66320),
      hand_r:     new THREE.Quaternion(0.07527, -0.39813, -0.07505, 0.91115),
    };

    if (this.gestureProgress < 1.0) {
      this.gestureProgress += delta / this.gestureDuration;
      const p = Math.min(1.0, this.gestureProgress);
      // Bell-curve arc guaranteed to smoothly return to 0 at end
      const arc = Math.sin(p * Math.PI);

      const targetUpperR = DESK_REST_QUATS.upperarm_r.clone();
      const targetLowerR = DESK_REST_QUATS.lowerarm_r.clone();
      const targetHandR  = DESK_REST_QUATS.hand_r.clone();

      const liftDeltaUpper = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), arc * 0.16);
      const liftDeltaLower = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), arc * 0.14);
      const liftDeltaHand  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), arc * 0.20);

      targetUpperR.multiply(liftDeltaUpper);
      targetLowerR.multiply(liftDeltaLower);
      targetHandR.multiply(liftDeltaHand);

      this.bones.upperarmR.quaternion.slerp(targetUpperR, Math.min(1, delta * 8.0));
      this.bones.lowerarmR.quaternion.slerp(targetLowerR, Math.min(1, delta * 8.0));
      this.bones.handR.quaternion.slerp(targetHandR, Math.min(1, delta * 8.0));

      if (this.gestureType === "EXPLAINING_OPEN_PALMS") {
        const targetUpperL = DESK_REST_QUATS.upperarm_l.clone();
        const targetLowerL = DESK_REST_QUATS.lowerarm_l.clone();
        const targetHandL  = DESK_REST_QUATS.hand_l.clone();

        const liftDeltaUpperL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), arc * 0.16);
        const liftDeltaLowerL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), arc * 0.14);
        const liftDeltaHandL  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -arc * 0.20);

        targetUpperL.multiply(liftDeltaUpperL);
        targetLowerL.multiply(liftDeltaLowerL);
        targetHandL.multiply(liftDeltaHandL);

        this.bones.upperarmL.quaternion.slerp(targetUpperL, Math.min(1, delta * 8.0));
        this.bones.lowerarmL.quaternion.slerp(targetLowerL, Math.min(1, delta * 8.0));
        this.bones.handL.quaternion.slerp(targetHandL, Math.min(1, delta * 8.0));
      } else {
        this.bones.upperarmL.quaternion.slerp(DESK_REST_QUATS.upperarm_l, Math.min(1, delta * 6.0));
        this.bones.lowerarmL.quaternion.slerp(DESK_REST_QUATS.lowerarm_l, Math.min(1, delta * 6.0));
        this.bones.handL.quaternion.slerp(DESK_REST_QUATS.hand_l, Math.min(1, delta * 6.0));
      }
    } else {
      const returnRate = 5.0;
      this.bones.upperarmR.quaternion.slerp(DESK_REST_QUATS.upperarm_r, Math.min(1, delta * returnRate));
      this.bones.lowerarmR.quaternion.slerp(DESK_REST_QUATS.lowerarm_r, Math.min(1, delta * returnRate));
      this.bones.handR.quaternion.slerp(DESK_REST_QUATS.hand_r, Math.min(1, delta * returnRate));

      this.bones.upperarmL.quaternion.slerp(DESK_REST_QUATS.upperarm_l, Math.min(1, delta * returnRate));
      this.bones.lowerarmL.quaternion.slerp(DESK_REST_QUATS.lowerarm_l, Math.min(1, delta * returnRate));
      this.bones.handL.quaternion.slerp(DESK_REST_QUATS.hand_l, Math.min(1, delta * returnRate));
    }
  }

  private flushMorphTargets(delta: number) {
    if (this.morphMeshes.length === 0 && !this.morphMesh) return;

    const lerpSpeed = 22.0;

    this.targetMorphValues.forEach((targetVal, name) => {
      if (this.morphDictionary[name] === undefined) return;

      const currentVal = this.activeMorphValues.get(name) || 0;
      const nextVal = currentVal + (targetVal - currentVal) * Math.min(1.0, delta * lerpSpeed);

      this.activeMorphValues.set(name, nextVal);

      // Synchronously flush the calculated morph influence to ALL bound SkinnedMesh primitives
      // (Face Skin primitive 0, Teeth primitive 4, Lashes, Eyes, etc.)
      for (const mesh of this.morphMeshes) {
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          const idx = mesh.morphTargetDictionary[name];
          if (idx !== undefined) {
            mesh.morphTargetInfluences[idx] = nextVal;
          }
        }
      }

      if (this.morphMesh && this.morphMesh.morphTargetDictionary && this.morphMesh.morphTargetInfluences) {
        const primaryIdx = this.morphMesh.morphTargetDictionary[name];
        if (primaryIdx !== undefined) {
          this.morphMesh.morphTargetInfluences[primaryIdx] = nextVal;
        }
      }
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
    this.morphMeshes = [];
    this.morphDictionary = {};
    this.morphInfluences = [];
    this.activeMorphValues.clear();
    this.targetMorphValues.clear();
    this.isInitialized = false;
  }
}
