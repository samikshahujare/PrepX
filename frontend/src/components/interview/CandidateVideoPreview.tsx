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
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream && !isMinimized) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isMinimized]);

  if (isMinimized) {
    return (
      <div className="relative w-full h-[40px] rounded-xl overflow-hidden glass-panel border border-white/10 bg-slate-950 flex items-center justify-between px-3 shadow-lg shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white truncate max-w-[130px]">
            {candidateName}
          </span>
          <div className="flex items-center gap-1 ml-1 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-white/5">
            <Activity className="h-3 w-3 text-cyan-400" />
            <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  audioLevel > 50 ? "bg-emerald-400" : "bg-cyan-400"
                }`}
                style={{ width: `${micEnabled ? Math.min(audioLevel, 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMic}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            className={`p-1 rounded-lg text-xs border transition-all ${
              micEnabled
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-red-500/20 text-red-300 border-red-500/30"
            }`}
          >
            {micEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          </button>

          <button
            onClick={onToggleCamera}
            title={cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
            className={`p-1 rounded-lg text-xs border transition-all ${
              cameraEnabled && !cameraError
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                : "bg-slate-800 text-slate-400 border-white/10"
            }`}
          >
            {cameraEnabled && !cameraError ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
          </button>

          <button
            onClick={() => setIsMinimized(false)}
            title="Expand Camera Preview"
            className="p-1 rounded-lg text-xs bg-slate-800/80 hover:bg-white/10 text-slate-300 border border-white/10 transition-all font-mono"
          >
            Expand ↗
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[125px] sm:h-[135px] rounded-2xl overflow-hidden glass-panel border border-white/10 bg-slate-950 flex flex-col justify-between p-3 shadow-xl shrink-0">
      {/* Live Video Feed or Placeholder */}
      <div className="absolute inset-0 z-0">
        {cameraEnabled && stream && stream.getVideoTracks().length > 0 && !cameraError ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-500 p-2 text-center">
            <User className="h-6 w-6 text-slate-400 mb-1" />
            <p className="text-[11px] font-semibold text-slate-300">
              {cameraError ? "Camera Unavailable" : "Camera Disabled"}
            </p>
            {cameraError && onRetryMedia && (
              <button
                type="button"
                onClick={onRetryMedia}
                className="mt-1 px-2 py-0.5 text-[10px] rounded bg-indigo-600/30 text-indigo-200 border border-indigo-500/40"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top Overlay Badges */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-slate-950/75 backdrop-blur-md px-2.5 py-0.5 rounded-lg border border-white/10">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-white truncate max-w-[120px]">
            {candidateName}
          </span>
        </div>

        {/* Device Indicators & Minimize Button */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMic}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            className={`p-1 rounded-lg text-xs border backdrop-blur-md transition-all ${
              micEnabled
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-red-500/20 text-red-300 border-red-500/30"
            }`}
          >
            {micEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          </button>

          <button
            onClick={onToggleCamera}
            title={cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
            className={`p-1 rounded-lg text-xs border backdrop-blur-md transition-all ${
              cameraEnabled && !cameraError
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                : "bg-slate-800/80 text-slate-400 border-white/10"
            }`}
          >
            {cameraEnabled && !cameraError ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            title="Minimize camera to expand transcript"
            className="p-1 rounded-lg text-xs bg-slate-950/80 hover:bg-white/10 text-slate-300 border border-white/10 transition-all font-mono text-[10px]"
          >
            Minimize ↘
          </button>
        </div>
      </div>

      {/* Bottom Live Audio Level Visualizer & Privacy Note */}
      <div className="relative z-10 flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1 bg-slate-950/75 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
          <Activity className="h-3 w-3 text-cyan-400" />
          <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                audioLevel > 50 ? "bg-emerald-400" : "bg-cyan-400"
              }`}
              style={{ width: `${micEnabled ? Math.min(audioLevel, 100) : 0}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-slate-400">
            {micEnabled ? (audioLevel > 5 ? "Active" : "Silent") : "Muted"}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[9px] text-slate-400 bg-slate-950/75 backdrop-blur-md px-1.5 py-0.5 rounded border border-white/5">
          <Shield className="h-2.5 w-2.5 text-emerald-400" />
          <span>Local Feed</span>
        </div>
      </div>
    </div>
  );
}
