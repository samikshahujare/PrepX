"use client";

import React from "react";
import { Question } from "@/types";
import { HelpCircle, Sparkles, Target, Building } from "lucide-react";

interface InterviewHUDProps {
  currentQuestion: Question | null;
  currentIndex: number;
  totalQuestions: number;
  domain: string;
  company?: string | null;
  targetRole?: string | null;
  interviewMode?: string | null;
  durationMinutes?: number | null;
  attemptInfo?: string | null;
  isFollowup?: boolean;
}

export default function InterviewHUD({
  currentQuestion,
  currentIndex,
  totalQuestions,
  domain,
  company,
  targetRole,
  interviewMode,
  durationMinutes,
  attemptInfo,
  isFollowup = false,
}: InterviewHUDProps) {
  return (
    <div className="w-full glass-panel border border-white/10 rounded-2xl p-4 sm:p-5 bg-slate-950/70 shadow-lg transition-all">
      {/* Top Meta Details */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold font-mono">
            {currentIndex > 0 ? `Question ${currentIndex} / ${totalQuestions}` : `Question Queue (${totalQuestions})`}
          </span>

          {currentQuestion && (
            <>
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 text-[11px] font-semibold">
                {currentQuestion.category}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400 text-[11px]">
                {currentQuestion.difficulty} Level
              </span>
            </>
          )}

          {interviewMode && (
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-medium">
              {interviewMode}
            </span>
          )}

          {attemptInfo && (
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400 text-[11px] font-mono">
              {attemptInfo}
            </span>
          )}

          {durationMinutes && (
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400 text-[11px] font-mono">
              {durationMinutes} min
            </span>
          )}

          {isFollowup && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider animate-pulse">
              Active Follow-up
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
          {targetRole && (
            <span className="text-white font-semibold">
              {targetRole}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3 text-indigo-400" />
            <span className="text-slate-300 font-medium">{domain}</span>
          </span>
          {company && (
            <span className="flex items-center gap-1">
              • <Building className="h-3 w-3 text-cyan-400" />
              <span className="text-slate-300">{company}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Question Text Card */}
      <div className="flex items-start gap-3 pt-1">
        <div className="h-7 w-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
          <HelpCircle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm sm:text-base font-semibold text-white leading-relaxed tracking-tight">
            {currentQuestion
              ? currentQuestion.question_text
              : "Interview initialized. Click 'Start Interview' below to have Sarah present the first question."}
          </p>
        </div>
      </div>
    </div>
  );
}
