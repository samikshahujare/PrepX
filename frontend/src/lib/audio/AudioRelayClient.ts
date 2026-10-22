/**
 * PrepX Real-Time WebSocket Audio Relay Client
 * Provides linear PCM streaming over WebSocket and timeline-scheduled Web Audio API playback.
 * Resolves WebM/MediaRecorder slice decoding failure by using self-contained PCM frames.
 */

export interface AudioRelayCallbacks {
  onPeerSpeaking?: (senderId: string, isSpeaking: boolean) => void;
  onLocalAudioLevel?: (level: number) => void;
  onError?: (error: Error) => void;
}

export class AudioRelayClient {
  private ws: WebSocket | null = null;
  private participantId: string;
  private displayName: string;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private silentGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isRunning: boolean = false;
  private callbacks: AudioRelayCallbacks;
  private peerSpeakingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private peerPlayTimelines: Map<string, number> = new Map();
  private silenceHangoverFrames: number = 0;

  constructor(
    participantId: string,
    displayName: string,
    callbacks: AudioRelayCallbacks = {}
  ) {
    this.participantId = participantId;
    this.displayName = displayName;
    this.callbacks = callbacks;
  }

  public setWebSocket(ws: WebSocket | null) {
    this.ws = ws;
  }

  public async startCapture(): Promise<MediaStream> {
    if (this.isRunning && this.mediaStream) {
      return this.mediaStream;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;
      this.isRunning = true;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.playbackContext = new AudioCtx();

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      if (this.playbackContext.state === "suspended") {
        await this.playbackContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.sourceNode.connect(this.analyser);

      // ScriptProcessor with 2048 buffer size (~46ms per frame at 44.1kHz, ~128ms at 16kHz)
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);

      // Route through silent gain to prevent local speaker loopback/echo
      this.silentGain = this.audioContext.createGain();
      this.silentGain.gain.value = 0;

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.silentGain);
      this.silentGain.connect(this.audioContext.destination);

      this.scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isRunning || this.isMuted) {
          this.callbacks.onLocalAudioLevel?.(0);
          return;
        }

        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;
        const pcm16 = new Int16Array(input.length);

        for (let i = 0; i < input.length; i++) {
          const sample = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          sum += Math.abs(sample);
        }

        const avg = sum / input.length;
        const normalized = Math.min(100, Math.round(avg * 250));
        this.callbacks.onLocalAudioLevel?.(normalized);

        // Voice Activity Detection (VAD) with hangover protection to save bandwidth and prevent jitter
        const isVoiceActive = avg > 0.006;
        if (isVoiceActive) {
          this.silenceHangoverFrames = 5; // Retain ~230ms hangover to prevent syllable clipping
        } else if (this.silenceHangoverFrames > 0) {
          this.silenceHangoverFrames--;
        }

        const shouldTransmit = isVoiceActive || this.silenceHangoverFrames > 0;

        // Transmit PCM chunk over WebSocket if open, active, and voice detected
        if (shouldTransmit && this.ws && this.ws.readyState === WebSocket.OPEN && !this.isMuted) {
          try {
            let binary = "";
            const bytes = new Uint8Array(pcm16.buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = window.btoa(binary);

            this.ws.send(
              JSON.stringify({
                type: "AUDIO_RELAY",
                sender_id: this.participantId,
                display_name: this.displayName,
                audio_data: base64Data,
                data: base64Data,
                sample_rate: this.audioContext?.sampleRate || 44100,
                timestamp: Date.now(),
              })
            );
          } catch (err) {
            console.warn("[AudioRelayClient] Failed to send PCM chunk:", err);
          }
        }
      };

      return stream;
    } catch (err: unknown) {
      let friendlyMessage = "Failed to access microphone.";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          friendlyMessage = "Microphone permission was denied. Please allow microphone access in your browser settings to speak.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          friendlyMessage = "No microphone hardware detected on this device.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          friendlyMessage = "Microphone is currently in use by another application.";
        } else {
          friendlyMessage = err.message;
        }
      }
      const error = new Error(friendlyMessage);
      (error as any).name = err instanceof Error ? err.name : "MicrophoneError";
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (muted) {
      this.callbacks.onLocalAudioLevel?.(0);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  public async playPeerAudioChunk(senderId: string, base64Data: string, peerSampleRate?: number) {
    if (senderId === this.participantId || !base64Data) return; // Never loopback local voice

    // Trigger visual speaking indicator
    this.callbacks.onPeerSpeaking?.(senderId, true);
    const existingTimeout = this.peerSpeakingTimeouts.get(senderId);
    if (existingTimeout) clearTimeout(existingTimeout);
    this.peerSpeakingTimeouts.set(
      senderId,
      setTimeout(() => {
        this.callbacks.onPeerSpeaking?.(senderId, false);
      }, 400)
    );

    try {
      if (!this.playbackContext) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.playbackContext = new AudioCtx();
      }

      if (this.playbackContext.state === "suspended") {
        await this.playbackContext.resume();
      }

      // 1. Decode base64 to 16-bit PCM buffer
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      if (pcm16.length === 0) return;

      // 2. Convert to Float32Array for AudioBuffer
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 32768 : 32767);
      }

      // 3. Populate AudioBuffer
      const targetRate = peerSampleRate || this.playbackContext.sampleRate || 44100;
      const audioBuffer = this.playbackContext.createBuffer(1, float32.length, targetRate);
      audioBuffer.getChannelData(0).set(float32);

      // 4. Jitter buffer & timeline scheduling
      let nextPlayTime = this.peerPlayTimelines.get(senderId) || 0;
      const currentTime = this.playbackContext.currentTime;

      // If buffer underrun occurred or timeline is behind real-time, reset with 35ms safety cushion
      if (nextPlayTime < currentTime) {
        nextPlayTime = currentTime + 0.035;
      } else if (nextPlayTime > currentTime + 0.30) {
        // Latency ceiling: snap back if network jitter queue exceeded 300ms
        nextPlayTime = currentTime + 0.05;
      }

      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      source.start(nextPlayTime);

      this.peerPlayTimelines.set(senderId, nextPlayTime + audioBuffer.duration);
    } catch (err) {
      console.warn("[AudioRelayClient] Playback decode/schedule notice:", err);
    }
  }

  public async resumeAudioContext(): Promise<void> {
    try {
      if (this.audioContext && this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      if (this.playbackContext && this.playbackContext.state === "suspended") {
        await this.playbackContext.resume();
      }
    } catch (e) {
      console.warn("[AudioRelayClient] Error resuming audio context:", e);
    }
  }

  public cleanup() {
    this.isRunning = false;

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.silentGain) {
      this.silentGain.disconnect();
      this.silentGain = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.playbackContext) {
      this.playbackContext.close().catch(() => {});
      this.playbackContext = null;
    }

    this.peerSpeakingTimeouts.forEach((t) => clearTimeout(t));
    this.peerSpeakingTimeouts.clear();
    this.peerPlayTimelines.clear();
  }
}
