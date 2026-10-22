"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { authService } from "@/lib/auth";
import { gdService } from "@/lib/gd";
import {
  Users,
  Clock,
  Mic,
  MicOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  ArrowRight,
  ShieldCheck,
  Volume2,
} from "lucide-react";

interface ValidationData {
  session_id: string;
  session_code: string;
  topic: string;
  category: string;
  duration_minutes: number;
  max_participants: number;
  current_participants: number;
  status: string;
  expires_at?: string;
}

export default function GDJoinPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  // Validation State
  const [isValidating, setIsValidating] = useState(true);
  const [sessionData, setSessionData] = useState<ValidationData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Participant Form State
  const [displayName, setDisplayName] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Mic Testing State
  const [micState, setMicState] = useState<"idle" | "requesting" | "ready" | "denied">("idle");
  const [micVolume, setMicVolume] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 1. Validate Token & Preload User
  useEffect(() => {
    async function init() {
      if (!token) {
        setValidationError("Missing invitation token.");
        setIsValidating(false);
        return;
      }

      // Check current user if authenticated
      if (authService.isAuthenticated()) {
        try {
          const user = await authService.getCurrentUser();
          if (user?.profile?.full_name) {
            setDisplayName(user.profile.full_name);
          } else if (user?.email) {
            setDisplayName(user.email.split("@")[0]);
          }
        } catch {
          setIsGuest(true);
        }
      } else {
        setIsGuest(true);
      }

      // Validate invitation with backend
      try {
        const data = await gdService.validateInvitation(token);
        if (data.status === "COMPLETED" || data.status === "CANCELLED") {
          setValidationError(`This discussion session has already ended (Status: ${data.status}).`);
        } else if (data.current_participants >= data.max_participants) {
          setValidationError("This discussion room has already reached its maximum participant capacity.");
        } else {
          setSessionData(data);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid or expired invitation token.";
        setValidationError(msg);
      } finally {
        setIsValidating(false);
      }
    }

    init();

    return () => {
      // Cleanup audio stream on unmount
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [token]);

  // 2. Microphone Test Handler
  const handleTestMic = async () => {
    setMicState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setMicVolume(normalized);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      setMicState("ready");
    } catch {
      setMicState("denied");
    }
  };

  // 3. Join Session Action
  const handleJoin = async () => {
    if (!displayName.trim()) {
      setJoinError("Please enter your display name to join the discussion.");
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    try {
      const participantInfo = await gdService.joinWithInvitation(token, {
        display_name: displayName.trim(),
      });

      // Save participant info in storage for room connection
      if (typeof window !== "undefined") {
        sessionStorage.setItem("prepx_gd_participant", JSON.stringify(participantInfo));
      }

      const sessionCode = sessionData?.session_code || participantInfo.id;
      router.push(`/gd/room/${sessionCode}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to join discussion session.";
      setJoinError(msg);
      setIsJoining(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Verifying invitation token...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Invalid Token State */}
        {validationError && (
          <div className="bg-slate-900/80 border border-red-900/50 rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white">Unable to Join Discussion</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">{validationError}</p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Valid Invitation Joining Card */}
        {sessionData && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Group Discussion Invitation</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                {sessionData.session_code}
              </span>
            </div>

            {/* Topic Details */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                Discussion Topic
              </p>
              <h2 className="text-xl font-extrabold text-white leading-snug">
                {sessionData.topic}
              </h2>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  {sessionData.duration_minutes} Minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  {sessionData.current_participants} / {sessionData.max_participants} Participants
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  AI Evaluated
                </span>
              </div>
            </div>

            {/* Display Name Input */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider">
                Your Display Name {isGuest && <span className="text-emerald-400">(Guest Mode)</span>}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name (visible to participants & moderator)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
              />
            </div>

            {/* Audio Check / Mic Test */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  Microphone Check
                </span>
                <span className="text-[11px] text-slate-400">
                  {micState === "ready" ? "Microphone active & transmitting" : "Required for voice discussion"}
                </span>
              </div>

              {micState === "idle" && (
                <button
                  type="button"
                  onClick={handleTestMic}
                  className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition"
                >
                  <Mic className="w-4 h-4 text-emerald-400" />
                  Test Microphone Before Entering
                </button>
              )}

              {micState === "requesting" && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  Requesting microphone access...
                </div>
              )}

              {micState === "ready" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mic Ready
                    </span>
                    <span className="text-slate-400 font-mono">{micVolume}% Input Level</span>
                  </div>
                  {/* Visual volume level bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
                      style={{ width: `${micVolume}%` }}
                    />
                  </div>
                </div>
              )}

              {micState === "denied" && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/50 text-xs text-red-300 flex items-center gap-2">
                  <MicOff className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Microphone permission was denied. Please allow microphone permissions in your browser address bar.</span>
                </div>
              )}
            </div>

            {joinError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            {/* Join Action */}
            <button
              type="button"
              disabled={isJoining || !displayName.trim()}
              onClick={handleJoin}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting to Discussion Arena...
                </>
              ) : (
                <>
                  <span>Join Discussion Room</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
