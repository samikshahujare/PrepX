"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Award,
  Sparkles,
  Loader2,
} from "lucide-react";
import { InterviewTranscript, InterviewFeedbackReport } from "@/types";
import { interviewService } from "@/lib/interview";
import FeedbackReportModal from "./FeedbackReportModal";

interface InterviewCompletedModalProps {
  isOpen: boolean;
  sessionId?: string;
  domain: string;
  company?: string | null;
  totalQuestions: number;
  transcripts: InterviewTranscript[];
  onReviewTranscript: () => void;
}

export default function InterviewCompletedModal({
  isOpen,
  sessionId,
  domain,
  company,
  totalQuestions,
  transcripts,
  onReviewTranscript,
}: InterviewCompletedModalProps) {
  const router = useRouter();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackReport, setFeedbackReport] = useState<InterviewFeedbackReport | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  if (!isOpen) return null;

  const candidateMessages = transcripts.filter((t) => t.speaker === "candidate").length;

  const handleOpenFeedback = async () => {
    if (!sessionId) {
      router.push("/dashboard");
      return;
    }

    setShowFeedbackModal(true);
    setLoadingFeedback(true);
    try {
      const report = await interviewService.getSessionFeedback(sessionId);
      setFeedbackReport(report);
    } catch (err) {
      console.warn("Failed to fetch feedback directly, generating:", err);
      try {
        const report = await interviewService.generateSessionFeedback(sessionId);
        setFeedbackReport(report);
      } catch (genErr) {
        console.error("Failed to generate feedback report:", genErr);
      }
    } finally {
      setLoadingFeedback(false);
    }
  };

  return (
    <>
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
              Great job! Your real-time mock interview session with Sarah Jenkins has concluded.
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
                {candidateMessages} Answers ({transcripts.length} Turns)
              </span>
            </div>
          </div>

          {/* Feedback Readiness Note */}
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-2.5 mb-6">
            <Sparkles className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
            <p className="leading-relaxed">
              Your 9-section evidence-based Feedback Report is ready. Review your scores out of 5 across 8 competencies, strengths, weaknesses, and model answers.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleOpenFeedback}
              className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
            >
              <Award className="h-4 w-4" />
              <span>View Full Performance Feedback (Score / 5.0)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-2.5">
              <button
                onClick={onReviewTranscript}
                className="flex-1 px-4 py-2.5 rounded-xl glass-panel border border-white/10 hover:bg-white/5 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                Review Dialogue
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 px-4 py-2.5 rounded-xl glass-panel border border-white/10 hover:bg-white/5 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <FeedbackReportModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        report={feedbackReport}
        loading={loadingFeedback}
      />
    </>
  );
}
