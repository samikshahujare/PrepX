"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import AvatarStage from "@/components/interview/AvatarStage";
import PeerAudioGrid from "@/components/gd/PeerAudioGrid";
import SharedTranscriptPanel from "@/components/gd/SharedTranscriptPanel";
import { authService } from "@/lib/auth";
import { gdService } from "@/lib/gd";
import { AudioRelayClient } from "@/lib/audio/AudioRelayClient";
import { BrowserSpeechToTextProvider } from "@/lib/speech/BrowserSpeechToTextProvider";
import { BrowserTextToSpeechProvider } from "@/lib/speech/BrowserTextToSpeechProvider";
import {
  GDSession,
  GDParticipant,
  GDTranscriptSegment,
  InterviewState,
} from "@/types";
import {
  Users,
  Clock,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Radio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crown,
  Volume2,
} from "lucide-react";

export default function GDRoomPage() {
  const router = useRouter();
  const params = useParams();
  const sessionCode = params?.sessionCode as string;

  // Session & Participant State
  const [session, setSession] = useState<GDSession | null>(null);
  const [participants, setParticipants] = useState<GDParticipant[]>([]);
  const [myParticipant, setMyParticipant] = useState<GDParticipant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">("connecting");

  // Timer & Phase State
  const [remainingSeconds, setRemainingSeconds] = useState<number>(900);
  const [discussionStatus, setDiscussionStatus] = useState<string>("READY");

  // Audio & Mic State
  const [isMuted, setIsMuted] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Moderator State
  const [sarahText, setSarahText] = useState<string>("Initializing discussion arena with Sarah Jenkins...");
  const [sarahSpeaking, setSarahSpeaking] = useState(false);
  const [sarahAvatarState, setSarahAvatarState] = useState<InterviewState>("idle");

  // Transcripts State
  const [transcripts, setTranscripts] = useState<GDTranscriptSegment[]>([]);
  const [interimSpeech, setInterimSpeech] = useState<string>("");
  const [manualInput, setManualInput] = useState<string>("");

  // Refs for stable execution
  const wsRef = useRef<WebSocket | null>(null);
  const audioRelayRef = useRef<AudioRelayClient | null>(null);
  const sttProviderRef = useRef<BrowserSpeechToTextProvider | null>(null);
  const ttsProviderRef = useRef<BrowserTextToSpeechProvider | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionRef = useRef<GDSession | null>(null);
  const myParticipantRef = useRef<GDParticipant | null>(null);

  const [sttNotice, setSttNotice] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const pendingSarahOnEndRef = useRef<(() => void) | null>(null);
  const sarahSpeakingRef = useRef<boolean>(false);
  const sarahSpeakingEndTimeRef = useRef<number>(0);

  useEffect(() => {
    sarahSpeakingRef.current = sarahSpeaking;
  }, [sarahSpeaking]);

  // Audio Context User Gesture Autoplay Resumption
  useEffect(() => {
    const handleUserGesture = () => {
      audioRelayRef.current?.resumeAudioContext();
    };
    window.addEventListener("click", handleUserGesture);
    window.addEventListener("keydown", handleUserGesture);
    return () => {
      window.removeEventListener("click", handleUserGesture);
      window.removeEventListener("keydown", handleUserGesture);
    };
  }, []);

  // 1. Speak via Sarah Avatar Stage with synchronized mouth visemes
  const handleAvatarSpeakingEnd = useCallback(() => {
    setSarahSpeaking(false);
    setSarahAvatarState("listening");
    if (pendingSarahOnEndRef.current) {
      const cb = pendingSarahOnEndRef.current;
      pendingSarahOnEndRef.current = null;
      cb();
    }
  }, []);

  const speakSarahMessage = useCallback((text: string, onEnd?: () => void) => {
    setSarahText(text);
    setSarahSpeaking(true);
    setSarahAvatarState("speaking");
    pendingSarahOnEndRef.current = onEnd || null;

    const wordCount = (text || "").split(/\s+/).length;
    const estimatedDurationMs = Math.max(3500, wordCount * 450);
    sarahSpeakingEndTimeRef.current = Date.now() + estimatedDurationMs;

    // Safety timeout: if avatar speech synthesis or WebGL engine delays callback, reset cleanly
    const fallbackDurationMs = Math.max(3500, wordCount * 500);
    setTimeout(() => {
      setSarahSpeaking((prev) => {
        if (prev) {
          setSarahAvatarState("listening");
          if (pendingSarahOnEndRef.current) {
            const cb = pendingSarahOnEndRef.current;
            pendingSarahOnEndRef.current = null;
            cb();
          }
          return false;
        }
        return prev;
      });
    }, fallbackDurationMs);
  }, []);

  // 2. Initialize Session and Stored Participant
  useEffect(() => {
    async function initSession() {
      if (!sessionCode) return;

      let storedPartId: string | undefined;
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem("prepx_gd_participant");
        if (stored) {
          try {
            storedPartId = JSON.parse(stored)?.id;
          } catch {}
        }
      }

      try {
        const sess = await gdService.getSession(sessionCode, storedPartId);
        setSession(sess);
        sessionRef.current = sess;
        setRemainingSeconds(sess.duration_minutes * 60);

        // Preload prior transcripts if any
        try {
          const priorTranscripts = await gdService.getSessionTranscripts(sess.id, storedPartId);
          setTranscripts(priorTranscripts);
        } catch {}

        // Identify current participant from storage or user session
        let part: GDParticipant | null = null;
        if (typeof window !== "undefined") {
          const stored = sessionStorage.getItem("prepx_gd_participant");
          if (stored) {
            try {
              part = JSON.parse(stored);
            } catch {}
          }
        }

        // If not found in storage, match by logged in user
        if (!part && authService.isAuthenticated()) {
          try {
            const user = await authService.getCurrentUser();
            const matched = sess.participants?.find((p) => p.user_id === user.id);
            if (matched) {
              part = matched;
            }
          } catch {}
        }

        // If host/creator has no stored participant object, match host participant from session
        if (!part && sess.participants && sess.participants.length > 0) {
          const hostPart = sess.participants.find((p) => p.is_host);
          if (hostPart) {
            part = hostPart;
          }
        }

        if (!part) {
          throw new Error("You must join this discussion session via an invitation link or dashboard before entering the room.");
        }

        setMyParticipant(part);
        myParticipantRef.current = part;
        if (typeof window !== "undefined") {
          sessionStorage.setItem("prepx_gd_participant", JSON.stringify(part));
        }
        setParticipants(sess.participants && sess.participants.length > 0 ? sess.participants : [part]);
        setIsLoading(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load discussion session.";
        setErrorMsg(msg);
        setIsLoading(false);
      }
    }

    initSession();
  }, [sessionCode]);

  // 3. Connect Real-Time Audio Relay & WebSocket Gateway
  useEffect(() => {
    if (!session || !myParticipant) return;

    // A. Initialize AudioRelayClient
    const relay = new AudioRelayClient(myParticipant.id, myParticipant.display_name, {
      onPeerSpeaking: (senderId, isSpeaking) => {
        setActiveSpeakerIds((prev) => {
          const next = new Set(prev);
          if (isSpeaking) next.add(senderId);
          else next.delete(senderId);
          return next;
        });
      },
      onLocalAudioLevel: (level) => {
        setLocalAudioLevel(level);
      },
      onError: (err) => {
        console.warn("[AudioRelay Notice]:", err);
        setMicError(err.message || "Microphone error encountered.");
      },
    });

    audioRelayRef.current = relay;

    relay
      .startCapture()
      .then((stream) => {
        setMediaStream(stream);
        setMicError(null);
      })
      .catch((err) => {
        console.warn("[Mic capture warning]:", err);
        setMicError(err.message || "Microphone access was denied or is unavailable.");
      });

    // B. Connect WebSocket Gateway with dynamic public origin support
    let wsBaseUrl = "";
    if (process.env.NEXT_PUBLIC_WS_URL) {
      wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, "");
    } else if (process.env.NEXT_PUBLIC_API_URL) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
      const isHttps = apiUrl.startsWith("https://");
      const cleanHost = apiUrl.replace(/^https?:\/\//, "").replace(/\/api\/v1$/, "");
      wsBaseUrl = `${isHttps ? "wss" : "ws"}://${cleanHost}`;
    } else {
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      const host = typeof window !== "undefined"
        ? `${window.location.hostname}:8000`
        : "localhost:8000";
      wsBaseUrl = `${isHttps ? "wss" : "ws"}://${host}`;
    }

    const wsUrl = `${wsBaseUrl}/api/v1/gd/ws/${session.session_code}?participant_id=${myParticipant.id}&display_name=${encodeURIComponent(
      myParticipant.display_name
    )}&is_host=${myParticipant.is_host || myParticipant.role === "host" ? "true" : "false"}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    relay.setWebSocket(ws);

    ws.onopen = () => {
      setConnectionStatus("connected");
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
    };

    ws.onerror = (e) => {
      console.warn("[GD WebSocket Error]:", e);
      setConnectionStatus("reconnecting");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleIncomingWebSocketMessage(msg);
      } catch (err) {
        console.warn("[GD WS Parse Error]:", err);
      }
    };

    // C. Initialize Speech-To-Text for Attributable Transcription
    const stt = new BrowserSpeechToTextProvider();
    sttProviderRef.current = stt;

    if (stt.isSupported()) {
      stt.startListening({
        onInterimResult: (text) => {
          if (!isMuted && !sarahSpeakingRef.current && text.trim().length > 0) {
            setInterimSpeech(text);
          }
        },
        onFinalResult: (text) => {
          const cleanText = text.trim();
          if (!cleanText || isMuted) return;

          // Acoustic echo suppression: check if Sarah is currently speaking or just finished within 800ms
          const isDuringSarahPlayback = sarahSpeakingRef.current || Date.now() < sarahSpeakingEndTimeRef.current + 800;
          if (isDuringSarahPlayback) {
            const sarahWords = new Set((sarahText || "").toLowerCase().split(/\s+/));
            const candWords = cleanText.toLowerCase().split(/\s+/);
            const matches = candWords.filter((w) => sarahWords.has(w)).length;
            if (candWords.length >= 3 && matches / candWords.length > 0.65) {
              console.log("[STT] Suppressed speaker echo of Sarah's statement:", cleanText);
              return;
            }
          }

          setInterimSpeech("");
          // Send finalized attributable transcript chunk over WebSocket
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "TRANSCRIPT_CHUNK",
                message_id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                participant_id: myParticipant.id,
                speaker_name: myParticipant.display_name,
                message: cleanText,
                is_final: true,
                is_manual: false,
                is_moderator: false,
                timestamp_seconds: Math.max(
                  0,
                  session.duration_minutes * 60 - remainingSeconds
                ),
              })
            );
          }
        },
        onError: (err) => {
          console.warn("[STT Notice]:", err);
          setSttNotice(`Microphone transcription notice: ${err}`);
        },
      });
    } else {
      setSttNotice("Live speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge for automated voice transcription.");
    }

    return () => {
      ws.close();
      relay.cleanup();
      stt.stopListening();
      if (ttsProviderRef.current) {
        ttsProviderRef.current.stop();
      }
    };
  }, [session, myParticipant]);

  // 4. Timer Countdown Lifecycle
  useEffect(() => {
    if (discussionStatus === "IN_PROGRESS" || discussionStatus === "READY") {
      timerIntervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            handleTimeExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [discussionStatus]);

  // 5. Incoming WebSocket Message Dispatcher
  const handleIncomingWebSocketMessage = (msg: any) => {
    switch (msg.type) {
      case "SYNC_STATE":
      case "ROOM_STATE": {
        if (msg.participants) {
          setParticipants(msg.participants);
        }
        if (msg.remaining_seconds !== undefined) {
          setRemainingSeconds(msg.remaining_seconds);
        }
        if (msg.status) {
          setDiscussionStatus(msg.status);
        }
        break;
      }

      case "PARTICIPANT_JOINED": {
        setParticipants((prev) => {
          const newPart = msg.participant;
          const pId = newPart?.id || newPart?.participant_id;
          const exists = prev.some((p) => p.id === pId);
          if (exists) return prev;
          return [...prev, { ...newPart, id: pId }];
        });
        break;
      }

      case "PARTICIPANT_LEFT": {
        setParticipants((prev) => prev.filter((p) => p.id !== msg.participant_id));
        break;
      }

      case "MUTE_STATE_CHANGED":
      case "PARTICIPANT_MUTE_CHANGED": {
        setParticipants((prev) =>
          prev.map((p) => (p.id === msg.participant_id ? { ...p, is_muted: msg.is_muted } : p))
        );
        break;
      }

      case "AUDIO_CHUNK":
      case "AUDIO_RELAY": {
        const audioData = msg.audio_data || msg.data;
        if (audioRelayRef.current && audioData && msg.sender_id) {
          audioRelayRef.current.playPeerAudioChunk(msg.sender_id, audioData, msg.sample_rate);
        }
        break;
      }

      case "TRANSCRIPT_CHUNK":
      case "TRANSCRIPT_SEGMENT": {
        setTranscripts((prev) => [
          ...prev,
          {
            id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            session_id: sessionRef.current?.id,
            participant_id: msg.participant_id,
            speaker_name: msg.speaker_name,
            is_moderator: !!msg.is_moderator,
            is_manual: !!msg.is_manual,
            message: msg.message,
            timestamp_seconds: msg.timestamp_seconds || 0,
            created_at: new Date().toISOString(),
          } as any,
        ]);
        break;
      }

      case "MODERATOR_OPENING":
      case "DISCUSSION_STARTED": {
        setDiscussionStatus("IN_PROGRESS");
        const statement = msg.statement || msg.moderator_opening || "Welcome to the Group Discussion. The floor is now open.";
        speakSarahMessage(statement);
        setTranscripts((prev) => [
          ...prev,
          {
            id: `mod_${Date.now()}`,
            session_id: sessionRef.current?.id,
            participant_id: null,
            speaker_name: "Sarah Jenkins",
            is_moderator: true,
            message: statement,
            timestamp_seconds: 0,
            created_at: new Date().toISOString(),
          },
        ]);
        break;
      }

      case "MODERATOR_INTERVENTION":
      case "MODERATOR_SPEAK": {
        const text = msg.intervention || msg.statement || msg.message;
        if (text) {
          speakSarahMessage(text);
          setTranscripts((prev) => [
            ...prev,
            {
              id: `mod_${Date.now()}`,
              session_id: sessionRef.current?.id,
              participant_id: null,
              speaker_name: "Sarah Jenkins",
              is_moderator: true,
              message: text,
              timestamp_seconds: msg.timestamp_seconds || 0,
              created_at: new Date().toISOString(),
            },
          ]);
        }
        break;
      }

      case "MODERATOR_TIME_WARNING": {
        const warning = msg.statement || `We have ${msg.minutes_remaining} minutes remaining. Please structure your concluding remarks.`;
        speakSarahMessage(warning);
        break;
      }

      case "MODERATOR_CLOSING":
      case "SESSION_CONCLUDED": {
        setDiscussionStatus("COMPLETED");
        const closing = msg.statement || msg.moderator_closing || "Thank you everyone. The group discussion has concluded. Redirecting to your individualized feedback reports...";
        speakSarahMessage(closing, () => {
          handleConcludeAndEvaluate();
        });
        break;
      }

      case "SESSION_COMPLETED": {
        setDiscussionStatus("COMPLETED");
        handleNavigateToFeedback();
        break;
      }

      default:
        break;
    }
  };

  // 6. Mute / Unmute Toggle
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRelayRef.current) {
      audioRelayRef.current.setMuted(nextMuted);
    }
    if (wsRef.current?.readyState === WebSocket.OPEN && myParticipant) {
      wsRef.current.send(
        JSON.stringify({
          type: "MUTE_CHANGE",
          participant_id: myParticipant.id,
          is_muted: nextMuted,
        })
      );
    }
  };

  // 7. Discussion Ending & Evaluation Trigger
  const handleTimeExpired = () => {
    if (myParticipant?.is_host || myParticipant?.role === "host") {
      handleConcludeAndEvaluate();
    }
  };

  const handleStartDiscussion = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "START_DISCUSSION",
        })
      );
    }
  };

  const handleConcludeAndEvaluate = async () => {
    if (!session) return;
    setDiscussionStatus("COMPLETED");

    // Host triggers batch evaluation
    try {
      await gdService.evaluateAllParticipants(session.id);
    } catch (err) {
      console.warn("[Batch evaluation notice]:", err);
    }

    // Broadcast session completion over WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SESSION_COMPLETED",
          session_id: session.id,
        })
      );
    }

    handleNavigateToFeedback();
  };

  const handleNavigateToFeedback = () => {
    if (!session) return;
    const participantParam = myParticipant?.id ? `?participant_id=${myParticipant.id}` : "";
    router.push(`/gd/feedback/${session.id}${participantParam}`);
  };

  const handleLeaveRoom = () => {
    if (authService.isAuthenticated()) {
      router.push("/dashboard");
    } else {
      router.push("/");
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Entering Group Discussion Arena...</p>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-slate-900 border border-red-900/50 rounded-2xl p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold">Room Unavailable</h2>
          <p className="text-sm text-slate-400">{errorMsg || "Session not found."}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      <Navbar />

      {/* Arena Header Bar */}
      <header className="bg-slate-950/80 border-b border-slate-800 px-4 sm:px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Topic & Room Code */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                {session.session_code}
              </span>
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Group Discussion Arena
              </span>
              <div className="flex items-center gap-1.5 ml-2 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-amber-400"
                  }`}
                />
                <span className="text-slate-400 text-[11px] capitalize">
                  {connectionStatus}
                </span>
              </div>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white truncate max-w-3xl">
              {session.topic}
            </h1>
          </div>

          {/* Time Remaining & Controls */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="font-mono font-bold text-sm sm:text-base text-white">
                {formatTimer(remainingSeconds)}
              </span>
            </div>

            {discussionStatus !== "IN_PROGRESS" && discussionStatus !== "COMPLETED" && (myParticipant?.is_host || myParticipant?.role === "host") && (
              <button
                type="button"
                onClick={handleStartDiscussion}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start Discussion</span>
              </button>
            )}

            {(myParticipant?.is_host || myParticipant?.role === "host") && (
              <button
                type="button"
                onClick={handleConcludeAndEvaluate}
                className="px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-semibold text-xs transition flex items-center gap-1.5"
              >
                <span>End Discussion</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Microphone Hardware / Permission Notice Banner */}
      {micError && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
          <div className="bg-red-950/70 border border-red-500/50 text-red-200 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2.5">
              <MicOff className="w-4 h-4 shrink-0 text-red-400" />
              <div>
                <span className="font-semibold text-red-300">Microphone Issue: </span>
                <span>{micError}</span>
                <span className="ml-1.5 text-slate-400 text-[11px]">(You can still participate by typing your arguments below.)</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMicError(null)}
              className="text-red-400 hover:text-red-200 text-xs font-semibold ml-3"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Speech Recognition Error Banner */}
      {sttNotice && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
          <div className="bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs px-3.5 py-2 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{sttNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSttNotice(null)}
              className="text-amber-400 hover:text-amber-200 text-xs font-semibold ml-3"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Arena Content Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left Column (5 Cols): Sarah Jenkins AI Moderator 3D Avatar */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl flex-1 min-h-[360px] relative">
            {/* Moderator Badge */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Sarah Jenkins (AI Host & Moderator)</span>
            </div>

            {/* Speaking Status Pill */}
            {sarahSpeaking && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold backdrop-blur-md animate-pulse">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Moderating</span>
              </div>
            )}

            {/* Avatar 3D Stage */}
            <div className="flex-1 w-full relative min-h-[280px]">
              <AvatarStage
                sessionId={session.id}
                state={sarahAvatarState}
                interviewerText={sarahText}
                isSpeaking={sarahSpeaking}
                audioLevel={sarahSpeaking ? 80 : 0}
                showCandidateInset={false}
                candidateName={myParticipant?.display_name || "Candidate"}
                candidateStream={mediaStream}
                micEnabled={!isMuted}
                durationMinutes={session.duration_minutes}
                onSpeakingEnd={handleAvatarSpeakingEnd}
              />
            </div>

            {/* Live Subtitle / Statement Area */}
            <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 text-xs leading-relaxed text-slate-200">
              <span className="text-purple-400 font-semibold mr-1.5">[Sarah]:</span>
              <span>{sarahText}</span>
            </div>
          </div>
        </div>

        {/* Right Column (7 Cols): Candidate Audio Grid & Live Transcript */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
          {/* Top Half: Peer Audio Grid */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Participants ({participants.length}/{session.max_participants})</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Turn your mic on to participate
              </span>
            </div>

            <PeerAudioGrid
              participants={participants}
              currentParticipantId={myParticipant?.id}
              activeSpeakerIds={activeSpeakerIds}
              localIsMuted={isMuted}
              localAudioLevel={localAudioLevel}
            />
          </div>

          {/* Bottom Half: Synchronized Shared Transcript */}
          <div className="flex-1 min-h-[280px] flex flex-col gap-2">
            <SharedTranscriptPanel
              transcripts={transcripts}
              interimText={interimSpeech}
              interimSpeaker={myParticipant?.display_name}
            />

            {/* Quick statement / manual speech input fallback */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = manualInput.trim();
                if (!text || !myParticipant || !session) return;
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: "TRANSCRIPT_CHUNK",
                        message_id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                        participant_id: myParticipant.id,
                        speaker_name: myParticipant.display_name,
                        message: text,
                        is_final: true,
                        is_manual: true,
                        is_moderator: false,
                        timestamp_seconds: Math.max(0, session.duration_minutes * 60 - remainingSeconds),
                      })
                    );
                    setManualInput("");
                }
              }}
              className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl p-2 shrink-0"
            >
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Type and press Enter to contribute your statement..."
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs transition"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Bottom Sticky Controls Dock */}
      <footer className="bg-slate-950/90 border-t border-slate-800 px-4 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Local Audio Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Your Mic:
              </span>
              <span className={isMuted ? "text-red-400" : "text-emerald-400 font-semibold"}>
                {isMuted ? "Muted" : "Active & Transmitting"}
              </span>
            </div>

            {!isMuted && (
              <div className="hidden sm:block w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
                  style={{ width: `${localAudioLevel}%` }}
                />
              </div>
            )}
          </div>

          {/* Core Discussion Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleMute}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-lg ${
                isMuted
                  ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
            </button>

            <button
              type="button"
              onClick={handleLeaveRoom}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition"
            >
              <PhoneOff className="w-4 h-4 text-red-400" />
              <span>Leave Room</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
