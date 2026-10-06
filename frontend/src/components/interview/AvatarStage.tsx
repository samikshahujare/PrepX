"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { AvatarEngine } from "@/lib/avatar/AvatarEngine";
import { AvatarState, ExpressionState, AvatarProviderType, AvatarInitResult } from "@/lib/avatar/types";
import { InterviewState } from "@/types";
import {
  Volume2,
  Mic,
  BrainCircuit,
  ShieldCheck,
  Sparkles,
  Bot,
  Clock,
  ChevronDown,
  PhoneOff,
  Video,
  VideoOff,
  MicOff,
  Radio,
} from "lucide-react";

interface AvatarStageProps {
  sessionId?: string;
  state: InterviewState;
  interviewerText?: string;
  isSpeaking: boolean;
  audioLevel?: number;
  onEndInterview?: () => void;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  micEnabled?: boolean;
  cameraEnabled?: boolean;
  candidateStream?: MediaStream | null;
  candidateName?: string;
  showCandidateInset?: boolean;
  durationMinutes?: number;
  onAvatarReady?: () => void;
  onSpeakingEnd?: () => void;
}

export default function AvatarStage({
  sessionId,
  state,
  interviewerText,
  isSpeaking,
  audioLevel = 0,
  onEndInterview,
  onToggleMic,
  onToggleCamera,
  micEnabled = true,
  cameraEnabled = true,
  candidateStream = null,
  candidateName = "Candidate",
  showCandidateInset = true,
  durationMinutes = 30,
  onAvatarReady,
  onSpeakingEnd,
}: AvatarStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const candidateVideoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<AvatarEngine | null>(null);

  // Active Provider: Real-Time 3D Human Avatar
  const [providerType] = useState<AvatarProviderType>("local_3d");
  const [avatarLiveState, setAvatarLiveState] = useState<AvatarState>("IDLE");
  const [isAvatarMounted, setIsAvatarMounted] = useState(false);

  // Stable references for speech lifecycle
  const onSpeakingEndRef = useRef(onSpeakingEnd);
  useEffect(() => {
    onSpeakingEndRef.current = onSpeakingEnd;
  }, [onSpeakingEnd]);

  const onAvatarReadyRef = useRef(onAvatarReady);
  useEffect(() => {
    onAvatarReadyRef.current = onAvatarReady;
  }, [onAvatarReady]);

  const lastSpokenTextRef = useRef<string | null>(null);

  // Countdown Timer State initialized to provided duration
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState<number>(durationMinutes || 30);
  const [remainingSeconds, setRemainingSeconds] = useState<number>((durationMinutes || 30) * 60);
  const [isTimerDropdownOpen, setIsTimerDropdownOpen] = useState(false);

  // Synchronize duration if session duration changes
  useEffect(() => {
    if (durationMinutes && durationMinutes > 0) {
      setSelectedDurationMinutes(durationMinutes);
      setRemainingSeconds(durationMinutes * 60);
    }
  }, [durationMinutes]);

  // 1. Initialize Local AvatarEngine with Stable Session Lifecycle
  useEffect(() => {
    if (!containerRef.current) return;

    let isComponentMounted = true;
    const activeSessionKey = sessionId || "active_interview";
    const engine = AvatarEngine.getSessionEngine(activeSessionKey, "local_3d");
    engineRef.current = engine;
    if (typeof window !== "undefined") {
      (window as any).__activeAvatarEngine = engine;
    }

    engine.onReady(() => {
      if (!isComponentMounted) return;
      setIsAvatarMounted(true);
      onAvatarReadyRef.current?.();
    });

    engine.onStateChange((newState) => {
      if (!isComponentMounted) return;
      setAvatarLiveState(newState);
    });

    const targetMount = canvasMountRef.current || containerRef.current;

    if (engine.isReady()) {
      engine.attachMount(targetMount);
      setIsAvatarMounted(true);
      onAvatarReadyRef.current?.();
    } else {
      engine
        .initialize(targetMount, undefined, {
          vendor: "local",
          sessionId: activeSessionKey,
          durationMinutes: selectedDurationMinutes,
        })
        .then(() => {
          if (!isComponentMounted) return;
          setIsAvatarMounted(true);
          onAvatarReadyRef.current?.();
        })
        .catch((err) => {
          console.warn("Local avatar init notice:", err);
        });
    }

    const handleResize = () => {
      if (containerRef.current && engineRef.current) {
        engineRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isComponentMounted = false;
      window.removeEventListener("resize", handleResize);
    };
  }, [sessionId, selectedDurationMinutes]);

  // 2. Candidate Video Stream Inset handling
  useEffect(() => {
    if (candidateVideoRef.current && candidateStream) {
      candidateVideoRef.current.srcObject = candidateStream;
    }
  }, [candidateStream, cameraEnabled]);

  // 3. Mouse tracking for Candidate Gaze Interaction
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !engineRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const normX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const normY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      engineRef.current.onCandidateGaze(
        Math.max(-1, Math.min(1, normX)),
        Math.max(-1, Math.min(1, normY))
      );
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 4. Forward Semantic State and Recruiter Expressions to Local AvatarEngine
  useEffect(() => {
    if (!engineRef.current) return;

    let targetExpression: ExpressionState = "NEUTRAL";

    switch (state) {
      case "speaking":
        {
          const lower = (interviewerText || "").toLowerCase();
          const isStrong = /^(excellent|great|impressive|well done|very good|solid|spot on|insightful|outstanding)/i.test(lower.trim());
          const isClarification = /(could you elaborate|to clarify|can you clarify|what about|could you explain|dive deeper|more detail)/i.test(lower);
          const isGreetingOrClosing = /(hello|morning|welcome|thank you for your time|that concludes|pleasure speaking)/i.test(lower);

          if (isStrong) {
            targetExpression = "WARM_SMILE";
            engineRef.current.onCandidateGaveStrongAnswer();
          } else if (isClarification) {
            targetExpression = "CONCERNED";
            engineRef.current.onCandidateGaveWeakAnswer();
          } else if (isGreetingOrClosing) {
            targetExpression = "WARM_SMILE";
            engineRef.current.setState("SMILING");
          } else {
            targetExpression = "PROFESSIONAL_SERIOUS";
            engineRef.current.setState("SPEAKING");
          }
        }
        break;
      case "listening":
        targetExpression = "LISTENING";
        engineRef.current.setState("LISTENING");
        break;
      case "processing":
        targetExpression = "THINKING";
        engineRef.current.setState("THINKING");
        engineRef.current.triggerGesture("THINKING_TILT");
        break;
      case "paused":
        targetExpression = "NEUTRAL";
        engineRef.current.setState("PAUSED");
        break;
      case "completed":
        targetExpression = "WARM_SMILE";
        engineRef.current.setState("COMPLETED");
        break;
      default:
        targetExpression = "NEUTRAL";
        engineRef.current.setState("IDLE");
        break;
    }

    engineRef.current.setExpression(targetExpression);
  }, [state, interviewerText]);

  // 5. Authoritative Speech Trigger: Single Speech Stream Protection
  useEffect(() => {
    if (!engineRef.current) return;

    if (isSpeaking && interviewerText) {
      if (lastSpokenTextRef.current === interviewerText) {
        return;
      }
      lastSpokenTextRef.current = interviewerText;
      engineRef.current.speak(interviewerText, () => {
        lastSpokenTextRef.current = null;
        onSpeakingEndRef.current?.();
      });
    } else if (!isSpeaking) {
      if (lastSpokenTextRef.current !== null) {
        lastSpokenTextRef.current = null;
        engineRef.current.stopSpeaking();
      }
    }
  }, [isSpeaking, interviewerText]);

  // 6. Forward Mic Level for Real-time Reaction
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.onCandidateAudioLevel(audioLevel);
    }
  }, [audioLevel]);

  // 7. Decreasing Countdown Timer
  useEffect(() => {
    if (state === "paused" || state === "completed" || state === "idle") return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [state]);

  const handleSelectDuration = (minutes: number) => {
    setSelectedDurationMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    setIsTimerDropdownOpen(false);
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // State Badge Config: Matches Clean Local Semantic States
  const getStateBadge = () => {
    switch (avatarLiveState) {
      case "SPEAKING":
        return {
          text: "Sarah is Speaking",
          icon: <Volume2 className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />,
          classes: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
        };
      case "LISTENING":
        return {
          text: "Sarah is Listening",
          icon: <Mic className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />,
          classes: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        };
      case "THINKING":
        return {
          text: "Sarah is Thinking",
          icon: <BrainCircuit className="h-3.5 w-3.5 text-purple-400 animate-spin" />,
          classes: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        };
      case "ENCOURAGING":
      case "SMILING":
      case "NODDING":
        return {
          text: "Sarah Acknowledging",
          icon: <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />,
          classes: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        };
      case "CONCERNED":
        return {
          text: "Evaluating Response",
          icon: <Sparkles className="h-3.5 w-3.5 text-blue-400" />,
          classes: "bg-blue-500/20 text-blue-300 border-blue-500/40",
        };
      case "PAUSED":
        return {
          text: "Sarah is Paused",
          icon: <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />,
          classes: "bg-slate-800 text-slate-400 border-slate-700",
        };
      case "COMPLETED":
        return {
          text: "Interview Completed",
          icon: <Sparkles className="h-3.5 w-3.5 text-emerald-400" />,
          classes: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        };
      default:
        if (state === "listening") {
          return {
            text: "Sarah is Listening",
            icon: <Mic className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />,
            classes: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
          };
        }
        if (state === "processing") {
          return {
            text: "Sarah is Thinking",
            icon: <BrainCircuit className="h-3.5 w-3.5 text-purple-400 animate-spin" />,
            classes: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          };
        }
        return {
          text: "Sarah is Ready",
          icon: <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />,
          classes: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        };
    }
  };

  const badge = getStateBadge();

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[480px] sm:min-h-[540px] rounded-3xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl flex flex-col justify-between select-none"
    >
      {/* 1. Main Visual Rendering Layer: Local Sarah 2D Canvas Mount */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#070b14]"
      />

      {/* 2. Top Header Overlays */}
      <div className="relative z-10 flex flex-col gap-2 p-4 sm:p-5 pointer-events-auto">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Left: LIVE Badge, Recording, Countdown Timer */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white font-bold text-[11px] tracking-wider uppercase shadow-lg shadow-red-600/30">
              <Radio className="h-3 w-3 animate-pulse" />
              <span>LIVE</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-slate-200 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="h-2 w-2 rounded-full bg-red-500 -ml-3.5" />
              <span>Recording</span>
            </div>

            {/* Countdown Timer with Duration Selector */}
            <div className="relative">
              <button
                onClick={() => setIsTimerDropdownOpen(!isTimerDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-black/65 backdrop-blur-md border border-white/15 text-white text-xs font-mono font-semibold hover:bg-black/80 transition-all"
                title="Adjust interview target duration"
              >
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span>Virtual Interview - {formatTimer(remainingSeconds)}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {isTimerDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-48 rounded-xl bg-slate-900 border border-white/15 shadow-2xl p-1 z-30 flex flex-col gap-1 backdrop-blur-xl">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleSelectDuration(mins)}
                      className={`px-3 py-1.5 text-left text-xs rounded-lg transition-colors font-mono flex items-center justify-between ${
                        selectedDurationMinutes === mins
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span>{mins} Minutes</span>
                      {selectedDurationMinutes === mins && <span className="text-[10px]">Active</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Dynamic Semantic State Pill */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md shadow-lg transition-all duration-300 ${badge.classes}`}
            >
              {badge.icon}
              <span>{badge.text}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Center/Middle: Candidate Camera Inset (Picture-in-Picture) */}
      {showCandidateInset && candidateStream && (
        <div className="absolute bottom-20 right-4 z-20 w-44 sm:w-56 h-28 sm:h-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 pointer-events-auto backdrop-blur-md">
          {cameraEnabled && candidateStream.getVideoTracks().length > 0 ? (
            <video
              ref={candidateVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-2 text-center">
              <VideoOff className="h-6 w-6 text-slate-500 mb-1" />
              <span className="text-[10px]">Camera Disabled</span>
            </div>
          )}
          <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-medium text-white">
            {candidateName} (You)
          </div>
        </div>
      )}

      {/* 4. Bottom Overlay Bar: Name Tag & Meeting Action Buttons */}
      <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3 pointer-events-auto">
        {/* Sarah Jenkins (AI) Name Tag */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 shadow-xl">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
            Sarah Jenkins (AI)
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            3D AI Interviewer
          </span>

          {/* Voice Waveform Indicator */}
          {isSpeaking && (
            <div className="flex items-center gap-0.5 ml-1">
              {[12, 22, 16, 26, 14, 20].map((h, i) => (
                <span
                  key={i}
                  className="w-0.5 rounded-full bg-indigo-400 animate-pulse"
                  style={{
                    height: `${h}px`,
                    animationDelay: `${i * 120}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Room Floating Actions */}
        <div className="flex items-center gap-2">
          {onToggleMic && (
            <button
              onClick={onToggleMic}
              className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
                micEnabled
                  ? "bg-black/60 border-white/10 text-slate-300 hover:text-white hover:bg-black/80"
                  : "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
              }`}
              title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            >
              {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
          )}

          {onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
                cameraEnabled
                  ? "bg-black/60 border-white/10 text-slate-300 hover:text-white hover:bg-black/80"
                  : "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
              }`}
              title={cameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
            >
              {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </button>
          )}

          {onEndInterview && (
            <button
              onClick={onEndInterview}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>Leave Meeting</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
