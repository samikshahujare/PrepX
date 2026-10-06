"use client";

import React, { useState } from "react";
import { InterviewState } from "@/types";
import {
  Play,
  Pause,
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Send,
  SkipForward,
  Loader2,
  VolumeX,
  Volume2,
} from "lucide-react";

interface InterviewControlsProps {
  state: InterviewState;
  micEnabled: boolean;
  cameraEnabled: boolean;
  isProcessing: boolean;
  ttsEnabled: boolean;
  onStartInterview: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleTTS: () => void;
  onPauseInterview: () => void;
  onResumeInterview: () => void;
  onEndInterview: () => void;
  onNextQuestion: () => void;
  onSubmitResponse: (text: string) => void;
  currentSpeechText?: string;
}

export default function InterviewControls({
  state,
  micEnabled,
  cameraEnabled,
  isProcessing,
  ttsEnabled,
  onStartInterview,
  onToggleMic,
  onToggleCamera,
  onToggleTTS,
  onPauseInterview,
  onResumeInterview,
  onEndInterview,
  onNextQuestion,
  onSubmitResponse,
  currentSpeechText = "",
}: InterviewControlsProps) {
  const [manualText, setManualText] = useState("");
  const [showEndModal, setShowEndModal] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = manualText.trim() || currentSpeechText.trim();
    if (textToSend) {
      onSubmitResponse(textToSend);
      setManualText("");
    }
  };

  const isInterviewStarted = state !== "idle" && state !== "preparing";
  const isInterviewCompleted = state === "completed";

  return (
    <div className="w-full glass-panel border border-white/10 rounded-2xl p-4 bg-slate-950/80 shadow-2xl flex flex-col gap-3">
      {/* Response Input Bar (Active during listening/processing or manual typing) */}
      {isInterviewStarted && !isInterviewCompleted && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={manualText || currentSpeechText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={
              state === "listening"
                ? "Listening... Speak aloud or type your answer here..."
                : "Type your answer or response here..."
            }
            disabled={isProcessing || state === "paused"}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-colors"
          />
          <button
            type="submit"
            disabled={isProcessing || (!manualText.trim() && !currentSpeechText.trim())}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Send Answer</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Control Buttons Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1 border-t border-white/5">
        {/* Left: Device & Audio Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMic}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              micEnabled
                ? "bg-slate-900 border-white/10 text-slate-200 hover:bg-white/5"
                : "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
            }`}
          >
            {micEnabled ? <Mic className="h-3.5 w-3.5 text-emerald-400" /> : <MicOff className="h-3.5 w-3.5 text-red-400" />}
            <span className="hidden sm:inline">{micEnabled ? "Mic On" : "Mic Muted"}</span>
          </button>

          <button
            onClick={onToggleCamera}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              cameraEnabled
                ? "bg-slate-900 border-white/10 text-slate-200 hover:bg-white/5"
                : "bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700"
            }`}
          >
            {cameraEnabled ? <Camera className="h-3.5 w-3.5 text-indigo-400" /> : <CameraOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{cameraEnabled ? "Cam On" : "Cam Off"}</span>
          </button>

          <button
            onClick={onToggleTTS}
            title={ttsEnabled ? "AI Voice Enabled" : "AI Voice Muted"}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              ttsEnabled
                ? "bg-slate-900 border-white/10 text-slate-200 hover:bg-white/5"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            }`}
          >
            {ttsEnabled ? <Volume2 className="h-3.5 w-3.5 text-cyan-400" /> : <VolumeX className="h-3.5 w-3.5 text-amber-400" />}
            <span className="hidden md:inline">{ttsEnabled ? "AI Audio On" : "AI Audio Muted"}</span>
          </button>
        </div>

        {/* Center: Main Primary Action (Start / Pause / Resume) */}
        <div className="flex items-center gap-2">
          {!isInterviewStarted ? (
            <button
              onClick={onStartInterview}
              disabled={state === "preparing" || isProcessing}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 hover:scale-[1.02] disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>Start Interview</span>
            </button>
          ) : isInterviewCompleted ? (
            <span className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              Interview Completed
            </span>
          ) : (
            <>
              {state === "paused" ? (
                <button
                  onClick={onResumeInterview}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Resume Interview</span>
                </button>
              ) : (
                <button
                  onClick={onPauseInterview}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-white/10 flex items-center gap-1.5 transition-all"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={onNextQuestion}
                disabled={isProcessing}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-white/5 text-slate-300 font-medium text-xs border border-white/10 flex items-center gap-1.5 transition-all"
              >
                <SkipForward className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Next Question</span>
              </button>
            </>
          )}
        </div>

        {/* Right: End Interview */}
        <div>
          {isInterviewStarted && !isInterviewCompleted && (
            <button
              onClick={() => setShowEndModal(true)}
              className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>End Interview</span>
            </button>
          )}
        </div>
      </div>

      {/* End Interview Confirmation Dialog */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel border border-red-500/30 bg-slate-950 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <PhoneOff className="h-4 w-4 text-red-400" />
              End Interview Session?
            </h4>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to end this mock interview? Your dialogue transcript will be saved to your dashboard.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEndModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndModal(false);
                  onEndInterview();
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30"
              >
                Confirm & End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
