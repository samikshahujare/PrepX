"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  User,
  AlertCircle,
  Activity,
  Shield,
} from "lucide-react";

interface CandidateVideoPreviewProps {
  stream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  cameraError: string | null;
  micError: string | null;
  audioLevel: number; // 0 to 100
  candidateName?: string;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onRetryMedia?: () => void;
}

export default function CandidateVideoPreview({
  stream,
  cameraEnabled,
  micEnabled,
  cameraError,
  micError,
  audioLevel,
  candidateName = "Candidate",
  onToggleCamera,
  onToggleMic,
  onRetryMedia,
}: CandidateVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative w-full h-full min-h-[220px] rounded-2xl overflow-hidden glass-panel border border-white/10 bg-slate-950 flex flex-col justify-between p-4 shadow-xl">
      {/* Live Video Feed or Placeholder */}
      <div className="absolute inset-0 z-0">
        {cameraEnabled && stream && stream.getVideoTracks().length > 0 && !cameraError ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100" // Mirror camera preview
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-500 p-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-2">
              <User className="h-8 w-8" />
            </div>
            <p className="text-xs font-semibold text-slate-300">
              {cameraError ? "Camera Unavailable" : "Camera Disabled"}
            </p>
            {cameraError && (
              <p className="text-[11px] text-amber-400 mt-1 max-w-xs">{cameraError}</p>
            )}
            {cameraError && onRetryMedia && (
              <button
                type="button"
                onClick={onRetryMedia}
                className="mt-2.5 px-3 py-1 text-[11px] rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 transition-all font-medium"
              >
                Retry Device Access
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top Overlay Badges */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[160px]">
            {candidateName}
          </span>
        </div>

        {/* Device Indicators */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMic}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            className={`p-1.5 rounded-lg text-xs font-medium border backdrop-blur-md transition-all ${
              micEnabled
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
                : "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
            }`}
          >
            {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={onToggleCamera}
            title={cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
            className={`p-1.5 rounded-lg text-xs font-medium border backdrop-blur-md transition-all ${
              cameraEnabled && !cameraError
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30"
                : "bg-slate-800/80 text-slate-400 border-white/10 hover:bg-slate-700"
            }`}
          >
            {cameraEnabled && !cameraError ? (
              <Camera className="h-3.5 w-3.5" />
            ) : (
              <CameraOff className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom Live Audio Level Visualizer & Privacy Note */}
      <div className="relative z-10 flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10">
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                audioLevel > 50 ? "bg-emerald-400" : "bg-cyan-400"
              }`}
              style={{ width: `${micEnabled ? Math.min(audioLevel, 100) : 0}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {micEnabled ? (audioLevel > 5 ? "Active" : "Silent") : "Muted"}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-950/70 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/5">
          <Shield className="h-3 w-3 text-emerald-400" />
          <span>Local Feed (Not Saved)</span>
        </div>
      </div>
    </div>
  );
}
