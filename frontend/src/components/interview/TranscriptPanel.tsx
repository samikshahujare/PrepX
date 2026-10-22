"use client";

import React, { useEffect, useRef, useState } from "react";
import { InterviewTranscript, InterviewState } from "@/types";
import { Bot, User, MessageSquare, Sparkles, Mic, ArrowDown } from "lucide-react";

interface TranscriptPanelProps {
  transcripts: InterviewTranscript[];
  interimTranscript?: string;
  candidateName?: string;
  state: InterviewState;
}

export default function TranscriptPanel({
  transcripts,
  interimTranscript,
  candidateName = "You",
  state,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const userHasScrolledUpRef = useRef(false);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceFromBottom > 60;
    setUserScrolledUp(isUp);
    userHasScrolledUpRef.current = isUp;
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setUserScrolledUp(false);
      userHasScrolledUpRef.current = false;
    }
  };

  useEffect(() => {
    if (!userHasScrolledUpRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, interimTranscript]);

  return (
    <div className="relative w-full h-full min-h-0 rounded-2xl glass-panel border border-white/10 bg-slate-950/70 flex flex-col p-3.5 sm:p-4 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Live Transcript ({transcripts.length})
            </h3>
          </div>
        </div>

        {state === "listening" && (
          <span className="text-[10px] text-cyan-300 font-mono flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 animate-pulse">
            <Mic className="h-2.5 w-2.5" /> Listening to your speech...
          </span>
        )}
      </div>

      {/* Message Stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1.5 custom-scrollbar"
      >
        {transcripts.length === 0 && !interimTranscript ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Bot className="h-8 w-8 mb-2 text-slate-600" />
            <p className="text-xs font-medium text-slate-400">Interview has not started yet</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Click "Start Interview" to begin live conversation with Sarah.
            </p>
          </div>
        ) : (
          <>
            {transcripts.map((t) => {
              const isInterviewer = t.speaker === "interviewer";
              return (
                <div
                  key={t.id}
                  className={`flex gap-2.5 ${
                    isInterviewer ? "justify-start" : "justify-end"
                  }`}
                >
                  {isInterviewer && (
                    <div className="h-7 w-7 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                      isInterviewer
                        ? "bg-slate-900 border border-white/10 text-slate-200"
                        : "bg-indigo-600/90 text-white shadow-md shadow-indigo-600/20 border border-indigo-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isInterviewer ? "text-indigo-400" : "text-indigo-200"
                        }`}
                      >
                        {isInterviewer ? "Sarah (AI Interviewer)" : `${candidateName} (Candidate)`}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{t.message}</p>
                  </div>

                  {!isInterviewer && (
                    <div className="h-7 w-7 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-200 shrink-0 mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Interim Speech Bubble */}
            {interimTranscript && (
              <div className="flex gap-2.5 justify-end animate-pulse">
                <div className="max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed bg-indigo-950/70 border border-indigo-500/40 text-indigo-200 italic shadow-lg shadow-indigo-950/40">
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    <Mic className="h-3 w-3 animate-spin text-cyan-400" />
                    <span>Speaking in real-time...</span>
                  </div>
                  <p className="whitespace-pre-wrap">{interimTranscript}</p>
                </div>
                <div className="h-7 w-7 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-200 shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Jump-to-Bottom Pill when Scrolled Up */}
      {userScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold shadow-lg shadow-indigo-600/40 flex items-center gap-1.5 transition-all animate-bounce"
        >
          <ArrowDown className="h-3 w-3" />
          <span>Latest message</span>
        </button>
      )}
    </div>
  );
}
