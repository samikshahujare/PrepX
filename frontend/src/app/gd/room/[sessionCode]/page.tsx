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
import {
  BrowserSpeechToTextProvider,
  STTMicrophoneStatus,
} from "@/lib/speech/BrowserSpeechToTextProvider";
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
  MessageSquare,
  X,
  Send,
  AlertTriangle,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
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
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected"
  >("connecting");

  // Timer & Phase State
  const [remainingSeconds, setRemainingSeconds] = useState<number>(900);
  const [discussionStatus, setDiscussionStatus] = useState<string>("READY");

  // Audio & Mic State
  const [isMuted, setIsMuted] = useState(false);
  const [micStatus, setMicStatus] = useState<STTMicrophoneStatus>("listening");
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Moderator State
  const [sarahText, setSarahText] = useState<string>(
    "Welcome to the Group Discussion. Initializing AI moderation with Sarah Jenkins..."
  );
  const [sarahSpeaking, setSarahSpeaking] = useState(false);
  const [sarahAvatarState, setSarahAvatarState] = useState<InterviewState>("idle");

  // Transcripts & Chat Drawer State
  const [transcripts, setTranscripts] = useState<GDTranscriptSegment[]>([]);
  const [interimSpeech, setInterimSpeech] = useState<string>("");
  const [manualInput, setManualInput] = useState<string>("");
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);
  const [unreadTranscripts, setUnreadTranscripts] = useState<number>(0);

  // Stable Refs to eliminate stale closure bugs
  const isMutedRef = useRef<boolean>(false);
  const sarahSpeakingRef = useRef<boolean>(false);
  const sarahSpeakingEndTimeRef = useRef<number>(0);
  const remainingSecondsRef = useRef<number>(900);
  const sessionRef = useRef<GDSession | null>(null);
  const myParticipantRef = useRef<GDParticipant | null>(null);
  const isTranscriptOpenRef = useRef<boolean>(true);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRelayRef = useRef<AudioRelayClient | null>(null);
  const sttProviderRef = useRef<BrowserSpeechToTextProvider | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSarahOnEndRef = useRef<(() => void) | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    sarahSpeakingRef.current = sarahSpeaking;
  }, [sarahSpeaking]);

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    isTranscriptOpenRef.current = isTranscriptOpen;
    if (isTranscriptOpen) {
      setUnreadTranscripts(0);
    }
  }, [isTranscriptOpen]);

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

  // Sarah Avatar Speech Synchronization
  const handleAvatarSpeakingEnd = useCallback(() => {
    setSarahSpeaking(false);
    sarahSpeakingRef.current = false;
    setSarahAvatarState("listening");
    sttProviderRef.current?.setModeratorSpeaking(false);
    audioRelayRef.current?.setModeratorSpeaking(false);
    if (pendingSarahOnEndRef.current) {
      const cb = pendingSarahOnEndRef.current;
      pendingSarahOnEndRef.current = null;
      cb();
    }
  }, []);

  const speakSarahMessage = useCallback((text: string, onEnd?: () => void) => {
    setSarahText(text);
    setSarahSpeaking(true);
    sarahSpeakingRef.current = true;
    setSarahAvatarState("speaking");
    pendingSarahOnEndRef.current = onEnd || null;

    // Immediately gate candidate STT and Audio Relay to eliminate Sarah echo
    sttProviderRef.current?.setModeratorSpeaking(true);
    audioRelayRef.current?.setModeratorSpeaking(true);

    const wordCount = (text || "").split(/\s+/).length;
    const estimatedDurationMs = Math.max(3500, wordCount * 450);
    sarahSpeakingEndTimeRef.current = Date.now() + estimatedDurationMs;

    // Safety timeout: reset if avatar speech callback is delayed
    const fallbackDurationMs = Math.max(4000, wordCount * 500);
    setTimeout(() => {
      setSarahSpeaking((prev) => {
        if (prev) {
          sarahSpeakingRef.current = false;
          setSarahAvatarState("listening");
          sttProviderRef.current?.setModeratorSpeaking(false);
          audioRelayRef.current?.setModeratorSpeaking(false);
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

  // 1. Initialize Session & Authenticated / Guest Participant
  useEffect(() => {
    async function initSession() {
      if (!sessionCode) return;

      let storedPartId: string | undefined;
      let cachedParticipant: GDParticipant | null = null;
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem("prepx_gd_participant");
        if (stored) {
          try {
            cachedParticipant = JSON.parse(stored);
            storedPartId = cachedParticipant?.id;
          } catch {}
        }
      }

      try {
        const sess = await gdService.getSession(sessionCode, storedPartId);
        setSession(sess);
        sessionRef.current = sess;
        setRemainingSeconds(sess.duration_minutes * 60);
        remainingSecondsRef.current = sess.duration_minutes * 60;

        // Preload prior transcripts if any
        try {
          const priorTranscripts = await gdService.getSessionTranscripts(sess.id, storedPartId);
          setTranscripts(priorTranscripts);
        } catch {}

        // Identify current participant
        let part: GDParticipant | null = null;

        // 1. Verify cached participant belongs to THIS session
        if (cachedParticipant) {
          const belongsToThisSession =
            cachedParticipant.session_id === sess.id ||
            cachedParticipant.session_code === sess.session_code ||
            sess.participants?.some((p) => p.id === cachedParticipant?.id);

          if (belongsToThisSession) {
            const foundInSession = sess.participants?.find((p) => p.id === cachedParticipant?.id);
            part = foundInSession || cachedParticipant;
          }
        }

        // 2. If authenticated user, find participant by user_id
        if (!part && authService.isAuthenticated()) {
          try {
            const user = await authService.getCurrentUser();
            const matched = sess.participants?.find((p) => p.user_id === user.id);
            if (matched) part = matched;
          } catch {}
        }

        // 3. Fallback: If current user created this session and is host
        if (!part && authService.isAuthenticated()) {
          try {
            const user = await authService.getCurrentUser();
            if (user?.id === sess.creator_id) {
              const hostPart = sess.participants?.find((p) => p.is_host);
              if (hostPart) part = hostPart;
            }
          } catch {}
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

  // 2. Connect Real-Time Audio Relay & WebSocket Gateway
  useEffect(() => {
    if (!session || !myParticipant) return;

    // A. Initialize AudioRelayClient for live voice transmission
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
        console.warn("[AudioRelay Error]:", err);
        setMicError(err.message || "Microphone hardware error encountered.");
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

    // B. Connect WebSocket Gateway
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
      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname === "[::1]");
      if (isLocalhost) {
        wsBaseUrl = "ws://localhost:8000";
      } else {
        const host = typeof window !== "undefined" ? window.location.host : "";
        wsBaseUrl = `${isHttps ? "wss" : "ws"}://${host}`;
      }
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("prepx_access_token") : null;
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";

    const wsUrl = `${wsBaseUrl}/api/v1/gd/ws/${session.session_code}?participant_id=${myParticipant.id}&display_name=${encodeURIComponent(
      myParticipant.display_name
    )}&is_host=${myParticipant.is_host || myParticipant.role === "host" ? "true" : "false"}${tokenQuery}`;

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

    // C. Initialize Speech-To-Text Provider for Attributable Transcription
    const stt = new BrowserSpeechToTextProvider();
    sttProviderRef.current = stt;

    if (stt.isSupported()) {
      stt.startListening({
        onStatusChange: (status, details) => {
          setMicStatus(status);
          if (status === "permission_denied" || status === "no_microphone") {
            setMicError(details || "Microphone access blocked.");
          }
        },
        onInterimResult: (text) => {
          if (!isMutedRef.current && !sarahSpeakingRef.current && text.trim().length > 0) {
            setInterimSpeech(text);
          }
        },
        onFinalResult: (text) => {
          const cleanText = text.trim();
          if (!cleanText || isMutedRef.current) return;

          // Acoustic echo suppression: check if Sarah is currently speaking or just finished
          const isDuringSarahPlayback =
            sarahSpeakingRef.current || Date.now() < sarahSpeakingEndTimeRef.current + 800;
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
          if (ws.readyState === WebSocket.OPEN && myParticipantRef.current) {
            const activeParticipant = myParticipantRef.current;
            const currentSession = sessionRef.current;
            const totalDurationSecs = (currentSession?.duration_minutes || 15) * 60;
            const elapsedSecs = Math.max(0, totalDurationSecs - remainingSecondsRef.current);

            ws.send(
              JSON.stringify({
                type: "TRANSCRIPT_CHUNK",
                message_id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                participant_id: activeParticipant.id,
                speaker_name: activeParticipant.display_name,
                message: cleanText,
                is_final: true,
                is_manual: false,
                is_moderator: false,
                timestamp_seconds: elapsedSecs,
              })
            );
          }
        },
        onError: (err) => {
          console.warn("[STT Notice]:", err);
        },
      });
    } else {
      setMicStatus("unsupported");
    }

    return () => {
      ws.close();
      relay.cleanup();
      stt.stopListening();
    };
  }, [session?.id, myParticipant?.id]);

  // 3. Timer Countdown Lifecycle
  useEffect(() => {
    if (discussionStatus === "IN_PROGRESS") {
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

  // 4. Incoming WebSocket Message Dispatcher
  const handleIncomingWebSocketMessage = (msg: any) => {
    switch (msg.type) {
      case "SYNC_STATE":
      case "ROOM_STATE": {
        if (msg.participants) setParticipants(msg.participants);
        if (msg.remaining_seconds !== undefined) {
          setRemainingSeconds(msg.remaining_seconds);
          remainingSecondsRef.current = msg.remaining_seconds;
        }
        if (msg.status) setDiscussionStatus(msg.status);
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
        const senderId = msg.sender_id || msg.participant_id;
        // Strict self-exclusion to eliminate local echo loop
        if (
          myParticipantRef.current &&
          senderId &&
          senderId.trim().toLowerCase() === myParticipantRef.current.id.trim().toLowerCase()
        ) {
          break;
        }
        if (audioRelayRef.current && audioData && senderId) {
          audioRelayRef.current.playPeerAudioChunk(senderId, audioData, msg.sample_rate);
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
        if (!isTranscriptOpenRef.current) {
          setUnreadTranscripts((prev) => prev + 1);
        }
        break;
      }

      case "MODERATOR_OPENING":
      case "DISCUSSION_STARTED": {
        setDiscussionStatus("IN_PROGRESS");
        const statement =
          msg.statement ||
          msg.moderator_opening ||
          "Welcome to the Group Discussion. The floor is now open for anyone to initiate.";
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
        const warning =
          msg.statement ||
          `We have approximately ${msg.minutes_remaining || 1} minute remaining. Please summarize your concluding remarks.`;
        speakSarahMessage(warning);
        break;
      }

      case "MODERATOR_CLOSING":
      case "SESSION_CONCLUDED":
      case "SESSION_COMPLETED": {
        setDiscussionStatus("COMPLETED");
        const closing =
          msg.statement ||
          msg.moderator_closing ||
          "Thank you everyone. The group discussion has concluded. Redirecting to your individualized feedback reports...";
        speakSarahMessage(closing, () => {
          handleNavigateToFeedback();
        });
        break;
      }

      default:
        break;
    }
  };

  // 5. Mute / Unmute Toggle Handler
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    // Propagate to Audio Relay and STT Provider
    if (audioRelayRef.current) {
      audioRelayRef.current.setMuted(nextMuted);
    }
    if (sttProviderRef.current) {
      sttProviderRef.current.setMuted(nextMuted);
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

  // 6. Discussion Lifecycle Triggers
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

    try {
      await gdService.evaluateAllParticipants(session.id);
    } catch (err) {
      console.warn("[Batch evaluation notice]:", err);
    }

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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
        <h2 className="text-white text-base font-semibold">Joining Group Discussion Room...</h2>
        <p className="text-slate-400 text-xs mt-1">Connecting to Sarah Jenkins and room peers</p>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Unable to Enter Arena</h2>
          <p className="text-xs text-slate-300 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0a0e17] text-white flex flex-col overflow-hidden select-none">
      {/* 1. Google Meet-Style Top Header Bar */}
      <header className="h-14 px-4 sm:px-6 bg-[#0f1420] border-b border-slate-800/80 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm tracking-tight text-white bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              PrepX Arena
            </span>
            <span className="text-slate-600">|</span>
            <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[11px] font-mono text-slate-300 border border-slate-700/60">
              {session.session_code}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 truncate max-w-md lg:max-w-xl text-xs text-slate-300">
            <span className="text-slate-500 font-medium">Topic:</span>
            <span className="truncate font-semibold text-white">{session.topic}</span>
          </div>
        </div>

        {/* Center / Right Header Stats */}
        <div className="flex items-center gap-3">
          {/* Discussion State Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                discussionStatus === "IN_PROGRESS"
                  ? "bg-emerald-400 animate-pulse"
                  : discussionStatus === "COMPLETED"
                  ? "bg-blue-400"
                  : "bg-amber-400"
              }`}
            />
            <span className="text-[11px] font-medium text-slate-300 capitalize">
              {discussionStatus.toLowerCase().replace(/_/g, " ")}
            </span>
          </div>

          {/* Session Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 font-mono text-xs font-bold text-emerald-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          {/* Connection Badge */}
          <div
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${
              connectionStatus === "connected"
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                : connectionStatus === "reconnecting"
                ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
                : "bg-red-950/40 border-red-500/30 text-red-300"
            }`}
          >
            <Radio className="w-3 h-3" />
            <span className="capitalize">{connectionStatus}</span>
          </div>
        </div>
      </header>

      {/* Hardware / Permission Warning Notice */}
      {micError && (
        <div className="bg-red-950/90 border-b border-red-500/40 px-4 py-2 text-xs text-red-200 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>Microphone Notice:</strong> {micError}
            </span>
          </div>
          <button
            onClick={() => setMicError(null)}
            className="text-red-400 hover:text-white text-xs font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Main Body: Discussion Stage & Collapsible Side Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Stage (Avatar + Participant Cards) */}
        <main
          className={`flex-1 flex flex-col p-3 sm:p-4 gap-3 sm:gap-4 overflow-y-auto transition-all duration-300 ${
            isTranscriptOpen ? "lg:mr-[340px] xl:mr-[380px]" : "mr-0"
          }`}
        >
          {/* Top Half: Sarah Jenkins 3D AI Moderator Canvas Stage */}
          <div className="flex-1 min-h-[300px] sm:min-h-[360px] max-h-[500px] bg-[#0d121d] rounded-2xl border border-slate-800/90 relative flex flex-col overflow-hidden shadow-2xl">
            {/* Sarah Header Badge */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-bold text-white">Sarah Jenkins</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/60 text-purple-300 font-semibold">
                AI Moderator
              </span>
            </div>

            {/* Speaking Status Indicator */}
            {sarahSpeaking && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 text-xs font-bold backdrop-blur-md animate-pulse">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Moderating</span>
              </div>
            )}

            {/* Avatar 3D Canvas */}
            <div className="flex-1 w-full h-full relative">
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

            {/* Subtitle / Statement Banner */}
            <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800/90 text-xs text-slate-200 leading-relaxed flex items-center gap-2 shrink-0">
              <span className="text-purple-400 font-bold shrink-0">[Sarah]:</span>
              <span className="truncate">{sarahText}</span>
            </div>
          </div>

          {/* Bottom Half: Peer Discussion Audio Grid */}
          <div className="h-[210px] sm:h-[230px] bg-[#0d121d] rounded-2xl border border-slate-800/90 p-3 sm:p-4 flex flex-col shrink-0 shadow-lg overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>
                  Candidates ({participants.length}/{session.max_participants})
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Live voice activity & speaking turns
              </span>
            </div>

            <div className="flex-1">
              <PeerAudioGrid
                participants={participants}
                currentParticipantId={myParticipant?.id}
                activeSpeakerIds={activeSpeakerIds}
                localIsMuted={isMuted}
                localAudioLevel={localAudioLevel}
              />
            </div>
          </div>
        </main>

        {/* 3. Collapsible Side Transcript / Meeting Chat Drawer */}
        <aside
          className={`fixed lg:absolute top-14 bottom-16 right-0 w-full sm:w-[340px] xl:w-[380px] bg-[#0f1420] border-l border-slate-800/90 flex flex-col z-30 transition-transform duration-300 ${
            isTranscriptOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Drawer Header */}
          <div className="px-4 py-3 border-b border-slate-800/90 flex items-center justify-between shrink-0 bg-slate-950/60">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Discussion Transcript</span>
            </div>

            <button
              onClick={() => setIsTranscriptOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Close Transcript Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-hidden p-3 flex flex-col">
            <SharedTranscriptPanel
              transcripts={transcripts}
              interimText={interimSpeech}
              interimSpeaker={myParticipant?.display_name}
            />
          </div>

          {/* Text Statement Contribution Fallback */}
          <div className="p-3 border-t border-slate-800/90 bg-slate-950/80 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = manualInput.trim();
                if (!text || !myParticipant || !session) return;
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  const elapsedSecs = Math.max(
                    0,
                    session.duration_minutes * 60 - remainingSecondsRef.current
                  );
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
                      timestamp_seconds: elapsedSecs,
                    })
                  );
                  setManualInput("");
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Type text statement fallback..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-[10px] text-slate-500 mt-1.5 text-center">
              Voice speech is transcribed automatically.
            </div>
          </div>
        </aside>
      </div>

      {/* 4. Google Meet-Style Bottom Meeting Toolbar Dock */}
      <footer className="h-16 bg-[#0f1420] border-t border-slate-800/90 px-4 sm:px-8 flex items-center justify-between shrink-0 z-40">
        {/* Left: Candidate Info & Audio Wave */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-bold text-white truncate max-w-[160px]">
              {myParticipant?.display_name || "You"}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">
              {micStatus === "listening" && !isMuted
                ? "Microphone Active"
                : isMuted
                ? "Microphone Muted"
                : micStatus.replace(/_/g, " ")}
            </span>
          </div>

          {!isMuted && localAudioLevel > 0 && (
            <div className="hidden md:flex items-center gap-0.5 h-4 w-12 bg-slate-900/60 px-1 rounded-md">
              <div
                className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75"
                style={{ height: `${Math.min(100, localAudioLevel * 2)}%` }}
              />
              <div
                className="w-1.5 bg-teal-400 rounded-full transition-all duration-75"
                style={{ height: `${Math.min(100, localAudioLevel * 1.5)}%` }}
              />
              <div
                className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75"
                style={{ height: `${Math.min(100, localAudioLevel * 2.2)}%` }}
              />
            </div>
          )}
        </div>

        {/* Center: Core Action Controls */}
        <div className="flex items-center gap-3">
          {/* Mic Toggle Button */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-lg ${
              isMuted
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/25 ring-2 ring-red-500/20"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 ring-2 ring-emerald-500/20"
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          {/* Transcript Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsTranscriptOpen((prev) => !prev)}
            className={`px-3.5 sm:px-4 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm flex items-center gap-2 border transition relative ${
              isTranscriptOpen
                ? "bg-slate-800 border-emerald-500/40 text-emerald-400"
                : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Transcript</span>
            {!isTranscriptOpen && unreadTranscripts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] animate-bounce">
                {unreadTranscripts}
              </span>
            )}
          </button>

          {/* Organiser Action Buttons */}
          {discussionStatus !== "IN_PROGRESS" &&
            discussionStatus !== "COMPLETED" &&
            (myParticipant?.is_host || myParticipant?.role === "host") && (
              <button
                type="button"
                onClick={handleStartDiscussion}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Discussion</span>
              </button>
            )}

          {(myParticipant?.is_host || myParticipant?.role === "host") && (
            <button
              type="button"
              onClick={handleConcludeAndEvaluate}
              className="px-3.5 py-2.5 rounded-2xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 font-semibold text-xs sm:text-sm transition flex items-center gap-1.5"
            >
              <span>End Discussion</span>
            </button>
          )}

          {/* Leave Discussion Button */}
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="px-3.5 sm:px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition"
          >
            <PhoneOff className="w-4 h-4 text-red-400" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        {/* Right Dock: Drawer Open Toggle (when collapsed) */}
        <div className="flex items-center gap-2">
          {!isTranscriptOpen && (
            <button
              onClick={() => setIsTranscriptOpen(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Open Transcript Drawer"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
