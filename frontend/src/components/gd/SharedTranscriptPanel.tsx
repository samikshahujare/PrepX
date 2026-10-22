"use client";

import React, { useEffect, useRef } from "react";
import { GDTranscriptSegment } from "@/types";
import { Sparkles, MessageSquare, Bot, User, Clock } from "lucide-react";

interface SharedTranscriptPanelProps {
  transcripts: GDTranscriptSegment[];
  interimText?: string;
  interimSpeaker?: string;
}

export default function SharedTranscriptPanel({
  transcripts,
  interimText,
  interimSpeaker,
}: SharedTranscriptPanelProps) {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new transcripts
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts, interimText]);

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
          <MessageSquare className="w-4 h-4" />
          <span>Live Synchronized Transcript</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {transcripts.length} {transcripts.length === 1 ? "utterance" : "utterances"}
        </span>
      </div>

      {/* Transcript Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
        {transcripts.length === 0 && !interimText && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
            <p className="text-xs">Live discussion transcript will stream here as participants and Sarah speak.</p>
          </div>
        )}

        {transcripts.map((t, index) => {
          const isModerator = t.is_moderator;

          return (
            <div
              key={t.id || index}
              className={`rounded-xl p-3 text-xs leading-relaxed transition ${
                isModerator
                  ? "bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border border-purple-500/30"
                  : "bg-slate-950/60 border border-slate-800/80"
              }`}
            >
              {/* Header with speaker tag and time */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {isModerator ? (
                    <span className="flex items-center gap-1 font-bold text-purple-300">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Sarah Jenkins (AI Host & Moderator)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-emerald-300">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.speaker_name}</span>
                      {(t as any).is_manual && (
                        <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-normal">
                          Text
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(t.timestamp_seconds)}
                </span>
              </div>

              {/* Message Content */}
              <p className={isModerator ? "text-purple-100" : "text-slate-200"}>
                {t.message}
              </p>
            </div>
          );
        })}

        {/* Interim / Streaming Utterance preview */}
        {interimText && (
          <div className="rounded-xl p-3 text-xs bg-slate-900/40 border border-dashed border-emerald-500/40 animate-pulse">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
              <User className="w-3.5 h-3.5" />
              <span>{interimSpeaker || "Speaking..."} (live)</span>
            </div>
            <p className="text-slate-300 italic">{interimText}</p>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>
    </div>
  );
}
