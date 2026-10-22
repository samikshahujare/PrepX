"use client";

import React from "react";
import { GDParticipant } from "@/types";
import { Mic, MicOff, Crown, User as UserIcon, Volume2 } from "lucide-react";

interface PeerAudioGridProps {
  participants: GDParticipant[];
  currentParticipantId?: string;
  activeSpeakerIds: Set<string>;
  localIsMuted: boolean;
  localAudioLevel: number;
}

export default function PeerAudioGrid({
  participants,
  currentParticipantId,
  activeSpeakerIds,
  localIsMuted,
  localAudioLevel,
}: PeerAudioGridProps) {
  // Generate a distinct avatar color based on name/id
  const getAvatarGradient = (seed: string) => {
    const gradients = [
      "from-emerald-500 to-teal-600",
      "from-blue-500 to-indigo-600",
      "from-violet-500 to-purple-600",
      "from-amber-500 to-orange-600",
      "from-cyan-500 to-blue-600",
      "from-pink-500 to-rose-600",
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 w-full">
      {participants.map((p) => {
        const isMe = p.id === currentParticipantId;
        const isSpeaking = isMe
          ? !localIsMuted && localAudioLevel > 15
          : activeSpeakerIds.has(p.id);
        const isMuted = isMe ? localIsMuted : p.is_muted;

        return (
          <div
            key={p.id}
            className={`relative rounded-2xl p-4 flex flex-col items-center justify-between transition-all duration-200 min-h-[140px] sm:min-h-[160px] border ${
              isSpeaking
                ? "bg-slate-900/90 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/40"
                : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
            }`}
          >
            {/* Top Bar inside Tile */}
            <div className="w-full flex items-center justify-between text-[11px] mb-2">
              {(p.is_host || p.role === "host") ? (
                <span className="flex items-center gap-1 text-amber-400 font-medium bg-amber-950/40 border border-amber-900/40 px-1.5 py-0.5 rounded-md">
                  <Crown className="w-3 h-3" />
                  Organiser
                </span>
              ) : (
                <span className="text-slate-500">Candidate</span>
              )}

              {/* Mic Icon */}
              <div
                className={`p-1 rounded-md ${
                  isMuted
                    ? "bg-red-950/60 text-red-400 border border-red-900/40"
                    : isSpeaking
                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 animate-pulse"
                    : "bg-slate-900 text-slate-400"
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </div>
            </div>

            {/* Avatar Circle with Soundwave / Speaking Ring */}
            <div className="relative my-auto">
              {isSpeaking && (
                <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping -z-10 scale-125" />
              )}
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                  p.id
                )} flex items-center justify-center text-white font-bold text-lg shadow-md border-2 ${
                  isSpeaking ? "border-emerald-400" : "border-slate-700"
                }`}
              >
                {p.display_name ? (
                  p.display_name.slice(0, 2).toUpperCase()
                ) : (
                  <UserIcon className="w-6 h-6" />
                )}
              </div>
            </div>

            {/* Bottom Label inside Tile */}
            <div className="w-full text-center mt-2">
              <p className="text-xs font-semibold text-white truncate max-w-[120px] mx-auto">
                {p.display_name} {isMe && <span className="text-emerald-400 font-normal">(You)</span>}
              </p>
              {isSpeaking && (
                <div className="flex items-center justify-center gap-1 mt-1 text-[10px] text-emerald-400 font-mono">
                  <Volume2 className="w-3 h-3 animate-pulse" />
                  <span>Speaking</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
