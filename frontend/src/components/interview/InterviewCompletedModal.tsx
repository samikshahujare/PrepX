"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, MessageSquare, Target, Clock, Sparkles } from "lucide-react";
import { InterviewTranscript } from "@/types";

interface InterviewCompletedModalProps {
  isOpen: boolean;
  domain: string;
  company?: string | null;
  totalQuestions: number;
  transcripts: InterviewTranscript[];
  onReviewTranscript: () => void;
}

export default function InterviewCompletedModal({
  isOpen,
  domain,
  company,
  totalQuestions,
  transcripts,
  onReviewTranscript,
}: InterviewCompletedModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const candidateMessages = transcripts.filter((t) => t.speaker === "candidate").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass-panel border border-emerald-500/30 bg-slate-950 p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Mock Interview Completed!
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Great job! Your real-time mock interview session with Sarah has successfully concluded.
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Target Track
            </span>
            <span className="text-xs font-semibold text-white truncate block">
              {domain}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Responses Recorded
            </span>
            <span className="text-xs font-semibold text-emerald-400">
              {candidateMessages} Responses ({transcripts.length} Entries)
            </span>
          </div>
        </div>

        {/* Next Steps Note */}
        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-2.5 mb-6">
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
          <p className="leading-relaxed">
            Your entire dialogue transcript is safely preserved in your workspace database. Phase 4 will provide granular scoring and performance feedback.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onReviewTranscript}
            className="flex-1 px-4 py-2.5 rounded-xl glass-panel border border-white/10 hover:bg-white/5 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
            Review Dialogue
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
          >
            <span>Return to Dashboard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
