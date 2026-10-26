"use client";

import React, { useState, useEffect, useRef } from "react";
import { AvatarEngine } from "@/lib/avatar/AvatarEngine";
import {
  Volume2,
  X,
  Play,
  RotateCcw,
  Sliders,
  Activity,
  Sparkles,
  Square,
} from "lucide-react";

interface LipSyncTestPanelProps {
  engine: AvatarEngine | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  text: string;
  isInterrupt?: boolean;
}

const TEST_CASES: TestCase[] = [
  {
    id: "short",
    name: "1. Short Normal Sentence",
    description: "Standard conversational greeting, normal cadence and closure.",
    text: "Hello, welcome to PrepX. Let's get started.",
  },
  {
    id: "long",
    name: "2. Complex Syllables & Vowels",
    description: "Multisyllabic vowel transitions and jaw opening bounds.",
    text: "Today we will discuss distributed caching architectures, database indexing, and scalability.",
  },
  {
    id: "bilabials",
    name: "3. Bilabial M, B, P Closure",
    description: "Verifies lips completely seal without jaw drop during M, B, and P.",
    text: "Please remember to mention your best project milestones and team problems.",
  },
  {
    id: "rounded",
    name: "4. Rounded O & U Sounds",
    description: "Verifies subtle lip rounding without ballooning or distorted funneling.",
    text: "You should look through our documentation about modern tools and group discussions.",
  },
  {
    id: "pauses",
    name: "5. Natural Sentence Pauses",
    description: "Verifies resting closure between sentences and after punctuation.",
    text: "Let's begin. First, introduce yourself. Then, tell me about your background.",
  },
  {
    id: "interrupt",
    name: "6. TTS Interruption & Reset",
    description: "Interrupts speech mid-sentence to verify clean instant reset to neutral.",
    text: "This long sentence will be deliberately interrupted midway to verify clean instant mouth closure.",
    isInterrupt: true,
  },
  {
    id: "silence",
    name: "7. Silence / Resting Neutral",
    description: "Verifies that the mouth stays completely closed when there is no speech.",
    text: "",
  },
  {
    id: "repetition",
    name: "8. Repetition Cycle",
    description: "Speaks consecutive sentences to verify zero accumulated morph distortion.",
    text: "First phrase for calibration. Second phrase for continuity. Third phrase for stability.",
  },
];

export default function LipSyncTestPanel({
  engine,
  isOpen,
  onClose,
}: LipSyncTestPanelProps) {
  const [tuningMode, setTuningMode] = useState<"tuned" | "exaggerated">("tuned");
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<any>({
    isSpeakingActive: false,
    currentViseme: "sil",
    visemeIntensity: 0,
    audioEnergy: 0,
    jawOpen: 0,
    sil_00: 1.0,
    p_b_m_21: 0,
    aa_02: 0,
    ow_08: 0,
  });

  const interruptTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen || !engine) return;

    const interval = setInterval(() => {
      const diag = engine.getLipSyncDiagnostics();
      if (diag) {
        setTelemetry(diag);
        if (diag.tuningMode && diag.tuningMode !== tuningMode) {
          setTuningMode(diag.tuningMode);
        }
      }
    }, 80);

    return () => clearInterval(interval);
  }, [isOpen, engine, tuningMode]);

  const handleToggleMode = (mode: "tuned" | "exaggerated") => {
    setTuningMode(mode);
    if (engine) {
      engine.setLipSyncTuningMode(mode);
    }
  };

  const handleRunTest = (testCase: TestCase) => {
    if (!engine) return;

    if (interruptTimerRef.current) {
      clearTimeout(interruptTimerRef.current);
      interruptTimerRef.current = null;
    }

    setActiveTestId(testCase.id);

    if (testCase.id === "silence") {
      engine.stopSpeaking();
      setTimeout(() => setActiveTestId(null), 1200);
      return;
    }

    engine.speak(testCase.text, () => {
      setActiveTestId(null);
    });

    if (testCase.isInterrupt) {
      interruptTimerRef.current = setTimeout(() => {
        engine.stopSpeaking();
        setActiveTestId(null);
      }, 1400);
    }
  };

  const handleStop = () => {
    if (interruptTimerRef.current) {
      clearTimeout(interruptTimerRef.current);
      interruptTimerRef.current = null;
    }
    setActiveTestId(null);
    if (engine) {
      engine.stopSpeaking();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-40 w-96 max-h-[85vh] flex flex-col rounded-2xl bg-slate-900/95 border border-white/20 shadow-2xl backdrop-blur-xl text-white overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-bold tracking-wide">
            Lip-Sync Tuner & Test Suite
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close Test Suite"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* A/B Mode Toggle */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Animation Mode:</span>
            <span
              className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                tuningMode === "tuned"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              {tuningMode === "tuned" ? "Tuned (Subtle & Realistic)" : "Exaggerated (Old)"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleToggleMode("tuned")}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                tuningMode === "tuned"
                  ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Tuned (Realistic)</span>
            </button>
            <button
              onClick={() => handleToggleMode("exaggerated")}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                tuningMode === "exaggerated"
                  ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Exaggerated (Old)</span>
            </button>
          </div>
        </div>

        {/* Live Telemetry Display */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>Live Articulation Telemetry</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-1.5 rounded bg-slate-950/80 border border-white/5">
              <span className="text-slate-400">Viseme:</span>{" "}
              <span className="text-cyan-300 font-bold">
                {telemetry.currentViseme}
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/80 border border-white/5">
              <span className="text-slate-400">Audio Energy:</span>{" "}
              <span className="text-indigo-300 font-bold">
                {(telemetry.audioEnergy || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/80 border border-white/5">
              <span className="text-slate-400">jawOpen:</span>{" "}
              <span
                className={`font-bold ${
                  (telemetry.jawOpen || 0) > 0.22 ? "text-red-400" : "text-emerald-300"
                }`}
              >
                {(telemetry.jawOpen || 0).toFixed(3)}
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/80 border border-white/5">
              <span className="text-slate-400">sil_00:</span>{" "}
              <span className="text-slate-300 font-bold">
                {(telemetry.sil_00 || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/80 border border-white/5">
              <span className="text-slate-400">p_b_m_21:</span>{" "}
              <span className="text-amber-300 font-bold">
                {(telemetry.p_b_m_21 || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/80 border border-white/5">
              <span className="text-slate-400">aa_02:</span>{" "}
              <span className="text-purple-300 font-bold">
                {(telemetry.aa_02 || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* 8 Repeatable Test Scenarios */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">8 Test Scenarios:</span>
            {telemetry.isSpeakingActive && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600/80 hover:bg-red-500 text-white font-medium text-[10px]"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {TEST_CASES.map((tc) => {
              const isActive = activeTestId === tc.id;
              return (
                <div
                  key={tc.id}
                  className={`p-2 rounded-xl border transition-all ${
                    isActive
                      ? "bg-indigo-950/60 border-indigo-500/60 shadow-lg shadow-indigo-950/40"
                      : "bg-slate-950/40 border-white/5 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-200 text-xs truncate">
                        {tc.name}
                      </div>
                      <div className="text-[10px] text-slate-400 line-clamp-1">
                        {tc.description}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRunTest(tc)}
                      disabled={isActive}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all shrink-0 ${
                        isActive
                          ? "bg-indigo-600 text-white animate-pulse"
                          : "bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Volume2 className="h-3 w-3 animate-spin" />
                          <span>Playing</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 fill-current" />
                          <span>Test</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
