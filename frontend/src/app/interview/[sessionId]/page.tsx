"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { authService } from "@/lib/auth";
import { interviewService } from "@/lib/interview";
import {
  User,
  InterviewSession,
  InterviewState,
  InterviewTranscript,
  Question,
} from "@/types";
import AvatarProvider from "@/components/interview/AvatarProvider";
import CandidateVideoPreview from "@/components/interview/CandidateVideoPreview";
import InterviewHUD from "@/components/interview/InterviewHUD";
import InterviewControls from "@/components/interview/InterviewControls";
import TranscriptPanel from "@/components/interview/TranscriptPanel";
import InterviewCompletedModal from "@/components/interview/InterviewCompletedModal";
import { AvatarEngine } from "@/lib/avatar/AvatarEngine";
import { BrowserSpeechToTextProvider } from "@/lib/speech/BrowserSpeechToTextProvider";
import { MockSpeechToTextProvider } from "@/lib/speech/MockSpeechProvider";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Bot,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function InterviewRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.sessionId as string) || "";

  // Authentication & Session data
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Interview state machine
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isFollowup, setIsFollowup] = useState(false);
  const [interviewerMessage, setInterviewerMessage] = useState("");
  const [transcripts, setTranscripts] = useState<InterviewTranscript[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const candidateDisplayName =
    user?.profile?.full_name ||
    (user?.email ? user.email.split("@")[0].replace(/[._-]/g, " ") : "Candidate");

  // Hardware Media Streams & Device States
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [candidateAudioLevel, setCandidateAudioLevel] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Speech to text states
  const [interimSpeech, setInterimSpeech] = useState("");
  const [finalSpeech, setFinalSpeech] = useState("");
  const [micNotice, setMicNotice] = useState<string | null>(null);

  // Provider refs
  const sttProviderRef = useRef<BrowserSpeechToTextProvider | MockSpeechToTextProvider | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pendingSpeechDoneRef = useRef<(() => void) | null>(null);

  // Avatar readiness & synchronized speech refs
  const isAvatarReadyRef = useRef<boolean>(false);
  const pendingGreetingRef = useRef<(() => void) | null>(null);

  // Real-time Voice Answer & Silence Detection Refs
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedSpeechRef = useRef<string>("");
  const finalSpeechRef = useRef<string>("");
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const handleSubmitResponseRef = useRef<(text: string) => Promise<void>>(async () => {});

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // 1. Initialize Authentication & Session
  useEffect(() => {
    async function initRoom() {
      const isDemoMode =
        sessionId?.startsWith("demo") ||
        sessionId === "preview" ||
        sessionId === "sarah";

      if (!authService.isAuthenticated() && !isDemoMode) {
        router.push("/login");
        return;
      }

      if (isDemoMode) {
        setUser({
          id: "demo-user",
          email: "candidate@prepx.ai",
          is_active: true,
          is_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          profile: {
            id: "p1",
            user_id: "demo-user",
            full_name: "Alex Morgan",
            target_domain: "Full Stack Software Engineering",
            experience_level: "Senior",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
        const demoSessionData: InterviewSession = {
          id: sessionId,
          user_id: "demo-user",
          domain: "Full Stack & Cloud Architecture",
          company: "Google",
          difficulty: "High",
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          questions: [
            {
              id: "q1",
              session_id: sessionId,
              question_text: "Tell me about yourself.",
              category: "Opening",
              difficulty: "Medium",
              source: "ai_generated",
              sequence_number: 1,
              created_at: new Date().toISOString(),
            },
            {
              id: "q2",
              session_id: sessionId,
              question_text: "Tell me about a key production system you designed.",
              category: "Resume",
              difficulty: "High",
              source: "ai_generated",
              sequence_number: 2,
              created_at: new Date().toISOString(),
            },
            {
              id: "q3",
              session_id: sessionId,
              question_text: "How do you ensure data consistency under high concurrent load?",
              category: "Technical",
              difficulty: "High",
              source: "ai_generated",
              sequence_number: 3,
              created_at: new Date().toISOString(),
            },
          ],
        };
        setSession(demoSessionData);
        setTotalQuestions(3);
        setCurrentQuestion(demoSessionData.questions![0]);
        setCurrentQuestionIndex(1);
        setLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);

        // Fetch session and existing questions
        const sessionData = await interviewService.getInterviewSession(sessionId);
        setSession(sessionData);

        const sessionQuestions = sessionData.questions || [];
        setTotalQuestions(sessionQuestions.length);
        if (sessionQuestions.length > 0) {
          setCurrentQuestion(sessionQuestions[0]);
          setCurrentQuestionIndex(1);
        }

        // Fetch any existing transcripts or runtime state
        try {
          const runtime = await interviewService.getInterviewRuntimeState(sessionId);
          if (runtime.transcripts && runtime.transcripts.length > 0) {
            setTranscripts(runtime.transcripts);
          }
          if (runtime.interview_status === "completed") {
            setInterviewState("completed");
            setShowCompletionModal(true);
          } else if (runtime.interview_status === "paused") {
            setInterviewState("paused");
          } else if (runtime.interview_status === "active" || sessionData.status === "in_progress") {
            setInterviewState("listening");
            if (runtime.current_question) {
              setCurrentQuestion(runtime.current_question);
            }
            if (runtime.current_question_index) {
              setCurrentQuestionIndex(runtime.current_question_index);
            }
            if (runtime.transcripts && runtime.transcripts.length > 0) {
              const lastInterviewerTrans = [...runtime.transcripts]
                .reverse()
                .find((t) => t.speaker === "interviewer");
              if (lastInterviewerTrans) {
                setInterviewerMessage(lastInterviewerTrans.message);
              }
            }
          }
        } catch (e) {
          // Runtime state fetch fallback
        }
      } catch (err: any) {
        console.error("Failed to load interview session:", err);
        setAccessError(
          err.response?.data?.message ||
            "Unable to access this interview room. Please ensure you are authorized."
        );
      } finally {
        setLoading(false);
      }
    }

    initRoom();
  }, [sessionId, router]);

  // 2. Initialize Camera & Microphone with Permission Handling
  const setupMediaDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setCameraError("Media devices not supported in this browser.");
      setMicError("Microphone not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setMediaStream(stream);
      setCameraError(null);
      setMicError(null);

      // Setup audio level analyzer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              // Map average to 0-100
              const level = Math.min(Math.round((avg / 128) * 100), 100);
              setCandidateAudioLevel(level);
            }
            animFrameRef.current = requestAnimationFrame(updateAudioLevel);
          };
          animFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      } catch (audioErr) {
        console.warn("Audio visualizer initialization notice:", audioErr);
      }
    } catch (err: any) {
      console.warn("Media devices permission notice:", err.name, err.message);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access in browser.");
        // Try audio-only so candidate can still speak into microphone
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMediaStream(audioStream);
          setMicError(null);
        } catch (audioErr) {
          setMicError("Microphone permission denied. Please allow microphone access.");
        }
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera device found on this system.");
        setMicError("No microphone device detected.");
      } else {
        // Try audio-only if camera is unavailable
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMediaStream(audioStream);
          setMicError(null);
          setCameraError("Camera unavailable. Running in audio-only mode.");
        } catch (audioOnlyErr) {
          setCameraError("Camera unavailable.");
          setMicError("Microphone unavailable.");
        }
      }
    }
  }, []);

  useEffect(() => {
    setupMediaDevices();

    // Cleanup hardware media streams on unmount
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (sttProviderRef.current) {
        sttProviderRef.current.stopListening();
      }
    };
  }, [setupMediaDevices]);

  // 3. Initialize Candidate Speech Recognition
  useEffect(() => {
    const browserSTT = new BrowserSpeechToTextProvider();
    sttProviderRef.current = browserSTT.isSupported()
      ? browserSTT
      : new MockSpeechToTextProvider();
  }, []);

  // Avatar readiness and speech lifecycle handlers
  const handleAvatarReady = useCallback(() => {
    isAvatarReadyRef.current = true;
    if (pendingGreetingRef.current) {
      const greetingFn = pendingGreetingRef.current;
      pendingGreetingRef.current = null;
      greetingFn();
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const scheduleSilenceSubmission = useCallback(
    (currentAccumulated: string) => {
      resetSilenceTimer();
      const text = (accumulatedSpeechRef.current || currentAccumulated).trim();
      if (!text || text.length < 2) return;

      silenceTimerRef.current = setTimeout(() => {
        const textToSubmit = (accumulatedSpeechRef.current || currentAccumulated).trim();
        if (
          textToSubmit.length >= 2 &&
          !isSpeakingRef.current &&
          !isProcessingRef.current &&
          !isSubmittingRef.current
        ) {
          console.info(
            "[STT Voice Turn] Natural silence threshold (5.2s) reached, submitting candidate answer:",
            textToSubmit
          );
          handleSubmitResponseRef.current(textToSubmit);
        }
      }, 5200); // 5.2-second natural pause threshold before auto-submitting answer
    },
    [resetSilenceTimer]
  );

  // 4. Start Listening Handler with Strict Microphone Isolation & Silence Auto-Submit
  const startListeningForCandidate = useCallback(() => {
    if (!sttProviderRef.current || !micEnabled || isSpeakingRef.current || isProcessingRef.current || isSubmittingRef.current) return;

    resetSilenceTimer();
    accumulatedSpeechRef.current = "";
    finalSpeechRef.current = "";
    setMicNotice(null);
    setInterviewState("listening");
    setInterimSpeech("");
    setFinalSpeech("");

    sttProviderRef.current.startListening({
      onSpeechStart: () => {
        if (isSpeakingRef.current || isProcessingRef.current || isSubmittingRef.current) return;
        resetSilenceTimer();
      },
      onSpeechEnd: () => {
        if (isSpeakingRef.current || isProcessingRef.current || isSubmittingRef.current) return;
        // Native utterance end: defer to the natural pause debounce threshold (5.2s) so candidate can resume thinking
        const text = accumulatedSpeechRef.current.trim();
        if (text.length >= 2) {
          scheduleSilenceSubmission(text);
        }
      },
      onInterimResult: (transcript) => {
        if (isSpeakingRef.current || isProcessingRef.current || isSubmittingRef.current) return;
        // Combine any accumulated finalized segments with the live progressive interim words
        const liveText = (finalSpeechRef.current ? `${finalSpeechRef.current} ${transcript}` : transcript).trim();
        accumulatedSpeechRef.current = liveText;
        setInterimSpeech(liveText);
        scheduleSilenceSubmission(liveText);
      },
      onFinalResult: (transcript) => {
        if (isSpeakingRef.current || isProcessingRef.current || isSubmittingRef.current) return;
        const cleanFinal = transcript.trim();
        if (!cleanFinal) return;

        finalSpeechRef.current = cleanFinal;
        accumulatedSpeechRef.current = cleanFinal;
        setFinalSpeech(cleanFinal);
        setInterimSpeech(cleanFinal);
        scheduleSilenceSubmission(cleanFinal);
      },
      onError: (err) => {
        console.warn("[Candidate STT Notice]:", err);
        setMicNotice(err);
      },
      onStateChange: (listening) => {
        if (!listening && interviewState === "listening") {
          // Keep listening state active
        }
      },
    });
  }, [micEnabled, interviewState, resetSilenceTimer, scheduleSilenceSubmission]);

  const handleSpeakingEnd = useCallback(() => {
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    // Enforce 350ms acoustic transition guard delay before opening candidate mic
    setTimeout(() => {
      if (pendingSpeechDoneRef.current) {
        const cb = pendingSpeechDoneRef.current;
        pendingSpeechDoneRef.current = null;
        cb();
      } else {
        startListeningForCandidate();
      }
    }, 350);
  }, [startListeningForCandidate]);

  // 5. Speak Interviewer Text Handler (routed authoritatively via Local Sarah TTS)
  const speakInterviewerMessage = useCallback(
    (message: string, onDone?: () => void) => {
      // Critical Audio Isolation: Immediately stop candidate microphone capture & debounce
      resetSilenceTimer();
      accumulatedSpeechRef.current = "";
      finalSpeechRef.current = "";
      isSubmittingRef.current = false;
      if (sttProviderRef.current) {
        sttProviderRef.current.stopListening();
      }
      setInterimSpeech("");
      setFinalSpeech("");

      if (!ttsEnabled) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        onDone?.();
        return;
      }

      pendingSpeechDoneRef.current = onDone || null;
      setInterviewerMessage(message);
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      setInterviewState("speaking");
    },
    [ttsEnabled, resetSilenceTimer]
  );

  // 6. Action: Start Interview
  const handleStartInterview = async () => {
    setIsProcessing(true);
    setInterviewState("preparing");

    const isDemo =
      sessionId?.startsWith("demo") ||
      sessionId === "preview" ||
      sessionId === "sarah";

    if (isDemo) {
      const candidateName = user?.profile?.full_name?.split(" ")[0] || "there";
      const currentHour = new Date().getHours();
      const timeGreeting =
        currentHour < 12
          ? "Good morning"
          : currentHour < 17
          ? "Good afternoon"
          : "Good evening";

      const greeting = `${timeGreeting}, ${candidateName}! I'm Sarah Jenkins, your AI technical interviewer today at PrepX. Let's begin: Tell me about yourself.`;
      setInterviewerMessage(greeting);
      const greetingTranscript: InterviewTranscript = {
        id: "t1",
        session_id: sessionId,
        question_id: "q1",
        speaker: "interviewer",
        message: greeting,
        sequence_number: 1,
        is_followup: false,
        created_at: new Date().toISOString(),
      };
      setTranscripts([greetingTranscript]);
      setIsProcessing(false);

      const triggerGreeting = () => {
        speakInterviewerMessage(greeting, () => {
          startListeningForCandidate();
        });
      };

      triggerGreeting();
      return;
    }

    try {
      const now = new Date();
      const startData = await interviewService.startInterviewSession(sessionId, {
        client_local_time: now.toISOString(),
        client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        client_hour: now.getHours(),
      });
      setCurrentQuestion(startData.current_question || null);
      setCurrentQuestionIndex(startData.current_question_index);
      setTotalQuestions(startData.total_questions);
      setInterviewerMessage(startData.interviewer_message);

      // Update transcripts
      const updatedTranscripts = await interviewService.getInterviewTranscripts(sessionId);
      setTranscripts(updatedTranscripts);

      // Synchronize greeting: Wait for Sarah's avatar stream to be READY before speaking
      const triggerGreeting = () => {
        speakInterviewerMessage(startData.interviewer_message, () => {
          startListeningForCandidate();
        });
      };

      // Start greeting immediately so candidate hears Sarah speak aloud
      triggerGreeting();
    } catch (err: any) {
      console.error("Failed to start interview:", err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to start interview session. Please try again.";
      if (err.response?.status === 401 || err.response?.status === 403) {
        setAccessError(errMsg);
      } else {
        setInterviewState("idle");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. Action: Submit Candidate Response
  const handleSubmitResponse = async (responseText: string) => {
    resetSilenceTimer();
    accumulatedSpeechRef.current = "";
    finalSpeechRef.current = "";
    if (!responseText.trim() || isProcessingRef.current || isSubmittingRef.current) return;

    if (sttProviderRef.current) {
      sttProviderRef.current.stopListening();
    }

    isSubmittingRef.current = true;
    setIsProcessing(true);
    isProcessingRef.current = true;
    setInterviewState("processing");
    setInterimSpeech("");
    setFinalSpeech("");

    // Trigger interviewer cognitive thinking animation on avatar
    (window as any).__sarahAvatar?.onInterviewerThinking?.();

    const isDemo =
      sessionId?.startsWith("demo") ||
      sessionId === "preview" ||
      sessionId === "sarah";

    if (isDemo) {
      const candidateTranscript: InterviewTranscript = {
        id: `t_${Date.now()}`,
        session_id: sessionId,
        question_id: currentQuestion?.id || null,
        speaker: "candidate",
        message: responseText.trim(),
        sequence_number: transcripts.length + 1,
        is_followup: isFollowup,
        created_at: new Date().toISOString(),
      };
      const updatedTrans = [...transcripts, candidateTranscript];
      setTranscripts(updatedTrans);

      // Enforce natural cognitive thinking pause
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const cleanResp = responseText.trim().toLowerCase();
      const isRepeatReq = /what could you please|could you repeat|repeat|pardon/i.test(cleanResp);
      const isMinimalYes = cleanResp === "yes" || cleanResp === "yeah" || cleanResp === "yep";

      let followUpMsg: string;
      let nextIsFollowup = isFollowup;

      if (isRepeatReq) {
        followUpMsg = `Of course. ${currentQuestion?.question_text || "Tell me about yourself."}`;
        nextIsFollowup = false;
      } else if (isMinimalYes) {
        followUpMsg = "Could you elaborate on the specific tools and technical trade-offs you considered?";
        nextIsFollowup = true;
      } else if (!isFollowup) {
        followUpMsg = "What was your specific contribution to that project?";
        nextIsFollowup = true;
      } else {
        followUpMsg = "Understood. How do you ensure data consistency under high concurrent load?";
        nextIsFollowup = false;
        setCurrentQuestionIndex((prev) => Math.min(prev + 1, 3));
      }

      setIsFollowup(nextIsFollowup);
      setInterviewerMessage(followUpMsg);

      const sarahTranscript: InterviewTranscript = {
        id: `t_${Date.now() + 1}`,
        session_id: sessionId,
        question_id: currentQuestion?.id || null,
        speaker: "interviewer",
        message: followUpMsg,
        sequence_number: updatedTrans.length + 1,
        is_followup: nextIsFollowup,
        created_at: new Date().toISOString(),
      };
      setTranscripts([...updatedTrans, sarahTranscript]);
      setIsProcessing(false);
      isProcessingRef.current = false;
      isSubmittingRef.current = false;

      speakInterviewerMessage(followUpMsg, () => {
        startListeningForCandidate();
      });
      return;
    }

    const submitStartTime = Date.now();

    try {
      const result = await interviewService.submitCandidateResponse(
        sessionId,
        responseText.trim()
      );

      // Avatar reaction based on evaluated answer quality
      if (result.answer_quality) {
        const action = result.answer_quality.interviewer_action;
        const score = result.answer_quality.score;
        if (action === "STRONG_ANSWER" || (score !== undefined && score >= 8)) {
          (window as any).__sarahAvatar?.onCandidateGaveStrongAnswer?.();
        } else if (action === "WEAK_ANSWER" || (score !== undefined && score < 5)) {
          (window as any).__sarahAvatar?.onCandidateGaveWeakAnswer?.();
        }
      }

      // Enforce natural cognitive thinking delay (~1100ms minimum)
      const elapsed = Date.now() - submitStartTime;
      const minThinkingDelay = 1100;
      if (elapsed < minThinkingDelay) {
        await new Promise((resolve) => setTimeout(resolve, minThinkingDelay - elapsed));
      }

      // Update transcripts immediately
      const updatedTranscripts = await interviewService.getInterviewTranscripts(sessionId);
      setTranscripts(updatedTranscripts);

      setIsFollowup(result.is_followup);
      setInterviewerMessage(result.interviewer_message);
      setCurrentQuestionIndex(result.current_question_index);
      if (result.current_question) {
        setCurrentQuestion(result.current_question);
      }

      if (result.is_completed) {
        // Speak final closing remarks
        speakInterviewerMessage(result.interviewer_message, () => {
          setInterviewState("completed");
          setShowCompletionModal(true);
        });
      } else {
        // Speak next question / follow-up
        speakInterviewerMessage(result.interviewer_message, () => {
          startListeningForCandidate();
        });
      }
    } catch (err: any) {
      console.error("Failed to process candidate response:", err);
      setInterviewState("error");
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
      isSubmittingRef.current = false;
    }
  };

  useEffect(() => {
    handleSubmitResponseRef.current = handleSubmitResponse;
  });

  // 8. Action: Next Question Skip
  const handleNextQuestion = async () => {
    if (isProcessingRef.current) return;
    resetSilenceTimer();
    accumulatedSpeechRef.current = "";
    if (sttProviderRef.current) {
      sttProviderRef.current.stopListening();
    }

    setIsProcessing(true);
    isProcessingRef.current = true;
    try {
      const result = await interviewService.advanceNextQuestion(sessionId);
      const updatedTranscripts = await interviewService.getInterviewTranscripts(sessionId);
      setTranscripts(updatedTranscripts);

      setIsFollowup(false);
      setInterviewerMessage(result.interviewer_message);
      setCurrentQuestionIndex(result.current_question_index);
      if (result.current_question) {
        setCurrentQuestion(result.current_question);
      }

      if (result.is_completed) {
        setInterviewState("completed");
        setShowCompletionModal(true);
      } else {
        speakInterviewerMessage(result.interviewer_message, () => {
          startListeningForCandidate();
        });
      }
    } catch (err) {
      console.error("Failed to advance question:", err);
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  // 9. Action: Pause Interview
  const handlePauseInterview = async () => {
    resetSilenceTimer();
    accumulatedSpeechRef.current = "";
    if (sttProviderRef.current) {
      sttProviderRef.current.stopListening();
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setInterviewState("paused");
    (window as any).__sarahAvatar?.onInterviewPaused?.();
    try {
      await interviewService.pauseInterviewSession(sessionId);
    } catch (e) {
      console.warn("Pause session notice:", e);
    }
  };

  // 10. Action: Resume Interview
  const handleResumeInterview = async () => {
    (window as any).__sarahAvatar?.onInterviewResumed?.();
    try {
      await interviewService.resumeInterviewSession(sessionId);
      setInterviewState("active");
      if (interviewerMessage) {
        speakInterviewerMessage(interviewerMessage, () => {
          startListeningForCandidate();
        });
      } else {
        startListeningForCandidate();
      }
    } catch (e) {
      console.warn("Resume session notice:", e);
    }
  };

  // 11. Action: End Interview
  const handleEndInterview = async () => {
    resetSilenceTimer();
    accumulatedSpeechRef.current = "";
    if (sttProviderRef.current) {
      sttProviderRef.current.stopListening();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setInterviewState("completed");
    (window as any).__sarahAvatar?.stop?.();

    // Clean up persistent session engine on explicit interview end
    AvatarEngine.destroySessionEngine("active_interview");

    try {
      await interviewService.endInterviewSession(sessionId);
      const updatedTranscripts = await interviewService.getInterviewTranscripts(sessionId);
      setTranscripts(updatedTranscripts);
    } catch (e) {
      console.warn("End session notice:", e);
    } finally {
      setShowCompletionModal(true);
    }
  };

  // Device Toggle Handlers
  const handleToggleCamera = () => {
    if (mediaStream) {
      const videoTracks = mediaStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !cameraEnabled;
        videoTracks.forEach((t) => (t.enabled = nextState));
        setCameraEnabled(nextState);
      }
    }
  };

  const handleToggleMic = () => {
    if (mediaStream) {
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !micEnabled;
        audioTracks.forEach((t) => (t.enabled = nextState));
        setMicEnabled(nextState);
      }
    }
  };

  const handleToggleTTS = () => {
    const nextState = !ttsEnabled;
    setTtsEnabled(nextState);
    if (!nextState) {
      setIsSpeaking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center text-white">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-300">Connecting to PrepX Mock Interview Room...</p>
      </div>
    );
  }

  if (accessError || !session) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="glass-panel border border-red-500/30 bg-slate-950 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
            <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Access Denied</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {accessError || "Interview session not found or you do not have permission to enter."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push("/interview/setup")}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Prepare New Interview
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 px-4 py-2.5 rounded-xl glass-panel text-slate-300 hover:text-white hover:bg-white/5 font-semibold text-xs flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen flex flex-col bg-[#0a0d14] text-slate-100 overflow-x-hidden lg:overflow-hidden">
      <Navbar />

      <main className="flex-1 min-h-0 max-w-[1560px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3 flex flex-col gap-3 overflow-hidden">
        {/* Top Room Banner HUD */}
        <div className="shrink-0">
          <InterviewHUD
            currentQuestion={currentQuestion}
            currentIndex={currentQuestionIndex}
            totalQuestions={totalQuestions}
            domain={session.domain}
            company={session.company}
            targetRole={session.target_role}
            interviewMode={session.interview_mode}
            durationMinutes={session.duration_minutes || 30}
            attemptInfo={session.allowed_attempts ? `Attempt ${session.current_attempt || 1} of ${session.allowed_attempts}` : undefined}
            isFollowup={isFollowup}
          />
        </div>

        {/* Main Split Grid: Left AI Interviewer Area & Right Candidate/Transcript Area */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 overflow-hidden">
          {/* Left / Center Main Stage: Dynamic Human-like Female AI Interviewer (Sarah) */}
          <div className="lg:col-span-7 h-[420px] lg:h-full min-h-0 flex flex-col">
            <AvatarProvider
              sessionId={sessionId}
              state={interviewState}
              interviewerText={interviewerMessage}
              isSpeaking={isSpeaking}
              audioLevel={candidateAudioLevel}
              onEndInterview={handleEndInterview}
              onToggleMic={handleToggleMic}
              onToggleCamera={handleToggleCamera}
              micEnabled={micEnabled}
              cameraEnabled={cameraEnabled}
              candidateStream={mediaStream}
              candidateName={user?.profile?.full_name || "Candidate"}
              showCandidateInset={false}
              durationMinutes={session.duration_minutes || 30}
              onAvatarReady={handleAvatarReady}
              onSpeakingEnd={handleSpeakingEnd}
            />
          </div>

          {/* Right Column: Candidate Camera Feed + Live Dialogue Transcript */}
          <div className="lg:col-span-5 h-auto lg:h-full min-h-0 flex flex-col gap-3 overflow-hidden">
            {/* Candidate Camera Preview */}
            <div className="shrink-0">
              <CandidateVideoPreview
                stream={mediaStream}
                cameraEnabled={cameraEnabled}
                micEnabled={micEnabled}
                cameraError={cameraError}
                micError={micError}
                audioLevel={candidateAudioLevel}
                candidateName={candidateDisplayName}
                onToggleCamera={handleToggleCamera}
                onToggleMic={handleToggleMic}
                onRetryMedia={setupMediaDevices}
              />
            </div>

            {/* Live Transcript Stream */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <TranscriptPanel
                transcripts={transcripts}
                interimTranscript={interimSpeech}
                candidateName={candidateDisplayName}
                state={interviewState}
              />
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="shrink-0">
          <InterviewControls
            state={interviewState}
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            isProcessing={isProcessing}
            ttsEnabled={ttsEnabled}
            onStartInterview={handleStartInterview}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onToggleTTS={handleToggleTTS}
            onPauseInterview={handlePauseInterview}
            onResumeInterview={handleResumeInterview}
            onEndInterview={handleEndInterview}
            onNextQuestion={handleNextQuestion}
            onSubmitResponse={handleSubmitResponse}
            currentSpeechText={interimSpeech || finalSpeech}
          />
        </div>
      </main>

      {/* Post-Interview Completion Modal */}
      <InterviewCompletedModal
        isOpen={showCompletionModal}
        sessionId={sessionId}
        domain={session?.domain || "Engineering"}
        company={session?.company}
        totalQuestions={totalQuestions}
        transcripts={transcripts}
        onReviewTranscript={() => setShowCompletionModal(false)}
      />
    </div>
  );
}
