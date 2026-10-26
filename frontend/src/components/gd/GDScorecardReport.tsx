"use client";

import React from "react";
import { GDEvaluation, GDSession } from "@/types";
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Target,
  Clock,
  Sparkles,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  Zap,
  MicOff,
  HelpCircle,
  AlertCircle,
} from "lucide-react";

interface GDScorecardReportProps {
  evaluation: GDEvaluation;
  session: GDSession;
  participantName?: string;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  communication_clarity: { label: "Communication Clarity", icon: "💬" },
  relevance_to_topic: { label: "Relevance to Topic", icon: "🎯" },
  quality_of_reasoning: { label: "Quality of Reasoning", icon: "🧠" },
  supporting_evidence: { label: "Supporting Evidence & Examples", icon: "📊" },
  critical_thinking: { label: "Critical Thinking", icon: "⚡" },
  listening_and_response: { label: "Active Listening & Response", icon: "👂" },
  constructive_collaboration: { label: "Constructive Collaboration", icon: "🤝" },
  respectful_disagreement: { label: "Respectful Disagreement", icon: "⚖️" },
  building_challenging_views: { label: "Building & Challenging Views", icon: "🏗️" },
  conciseness_organization: { label: "Conciseness & Organization", icon: "📐" },
  participation_balance: { label: "Participation Balance", icon: "⚖️" },
  conclusion_summarization: { label: "Concluding & Summarization", icon: "🏁" },
};

export default function GDScorecardReport({
  evaluation,
  session,
  participantName,
}: GDScorecardReportProps) {
  const plan = evaluation.personalized_plan || {};
  const speakingTurns = typeof plan.speaking_turns === "number" ? plan.speaking_turns : undefined;
  const wordCount = typeof plan.word_count === "number" ? plan.word_count : undefined;
  const isSilent = speakingTurns === 0 || evaluation.overall_score <= 1.0;
  const isMinimal = speakingTurns === 1;

  const overall = evaluation.overall_score || 1.0;

  const getScoreBadge = () => {
    if (isSilent) {
      return {
        label: "No Spoken Contribution",
        color: "text-slate-400 bg-slate-900/80 border-slate-700",
      };
    }
    if (isMinimal) {
      return {
        label: "Minimal Contribution",
        color: "text-amber-300 bg-amber-950/60 border-amber-500/40",
      };
    }
    if (overall >= 4.5) return { label: "Exceptional Leader", color: "text-emerald-400 bg-emerald-950/60 border-emerald-500/40" };
    if (overall >= 3.8) return { label: "Strong Contributor", color: "text-teal-300 bg-teal-950/60 border-teal-500/40" };
    if (overall >= 3.0) return { label: "Competent Participant", color: "text-blue-300 bg-blue-950/60 border-blue-500/40" };
    return { label: "Needs Practice", color: "text-amber-300 bg-amber-950/60 border-amber-500/40" };
  };

  const badge = getScoreBadge();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Top Hero Banner */}
      <div className={`bg-gradient-to-br ${
        isSilent
          ? "from-slate-900 via-slate-900/90 to-slate-950 border-slate-800"
          : "from-slate-900 via-emerald-950/20 to-slate-900 border-emerald-500/30"
      } border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${badge.color}`}>
                {badge.label}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {session.session_code}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {participantName ? `${participantName}'s GD Performance Report` : "Group Discussion Performance Report"}
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">Topic:</strong> {session.topic}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                {session.duration_minutes} Minutes Duration
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Individual Evidence Attribution
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                AI Moderator: Sarah Jenkins
              </span>
            </div>
          </div>

          {/* Overall Rating Box */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/80 border border-slate-800 shrink-0 text-center w-full md:w-auto min-w-[200px]">
            {isSilent ? (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-slate-400 font-semibold text-sm">
                  <MicOff className="w-4 h-4 text-slate-500" />
                  <span>Not Assessed</span>
                </div>
                <div className="text-2xl font-black text-slate-400">0 Spoken Turns</div>
                <p className="text-[11px] text-slate-500">No verbal evidence</p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                    {overall.toFixed(1)}
                  </span>
                  <span className="text-slate-500 font-bold text-lg">/ 5.0</span>
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                  Overall GD Rating
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Participation Summary Card */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-200">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Your Participation Summary</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {speakingTurns !== undefined ? `${speakingTurns} speaking turn${speakingTurns === 1 ? "" : "s"}` : "Attributed turns"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-medium">Recorded Turns</div>
            <div className="text-2xl font-bold text-white mt-1">
              {speakingTurns !== undefined ? speakingTurns : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Confirmed verbal entries</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-medium">Attributable Words</div>
            <div className="text-2xl font-bold text-white mt-1">
              {wordCount !== undefined ? wordCount : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Spoken words recorded</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-medium">Contribution Profile</div>
            <div className="text-sm font-bold text-emerald-400 mt-1 truncate">
              {isSilent ? "No Verbal Speech" : isMinimal ? "Minimal Entry" : "Substantive Discussion"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Evidence completeness</div>
          </div>
        </div>

        {isSilent && (
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200/90 leading-relaxed flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 font-semibold">Important Assessment Notice: </strong>
              This scorecard does not fabricate scores or claim you contributed arguments because no attributable verbal speech was recorded for your participant identity.
              If you experienced microphone hardware failure or browser permission issues, review the checklist in the Action Plan section below before retrying.
            </div>
          </div>
        )}
      </div>

      {/* 3. 12-Point Core GD Competencies */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">12-Point Core GD Competencies</h2>
          </div>
          <span className="text-xs text-slate-400">
            {isSilent ? "Not assessed (requires verbal evidence)" : "Grounded in your attributable utterances"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(evaluation.category_scores || {}).map(([key, scoreVal]) => {
            const meta = CATEGORY_META[key] || {
              label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              icon: "📌",
            };
            const num = Number(scoreVal) || 1.0;
            const pct = isSilent ? 0 : Math.min(100, Math.round((num / 5.0) * 100));

            return (
              <div
                key={key}
                className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <span className="text-xs font-bold text-white leading-tight">
                      {meta.label}
                    </span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${isSilent ? "text-slate-500" : "text-emerald-400"}`}>
                    {isSilent ? "N/A" : num.toFixed(1)}
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSilent ? "bg-slate-800" : "bg-gradient-to-r from-emerald-500 to-teal-400"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Strengths & Opportunities for Growth 2-Col */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>Observed Strengths</span>
          </div>

          <ul className="space-y-3">
            {(evaluation.strengths || []).map((s, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
            {(!evaluation.strengths || evaluation.strengths.length === 0) && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-400 italic">
                No verbal contributions were recorded during this session. Without speech evidence, strengths cannot be assessed.
              </div>
            )}
          </ul>
        </div>

        {/* Opportunities for Growth */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Opportunities for Growth</span>
          </div>

          <ul className="space-y-3">
            {(evaluation.areas_for_improvement || []).map((a, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 5. Qualitative Feedback Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
            <MessageSquare className="w-4 h-4" />
            <span>Communication & Delivery</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {evaluation.communication_feedback}
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
            <Zap className="w-4 h-4" />
            <span>Quality of Reasoning</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {evaluation.reasoning_feedback}
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
            <Target className="w-4 h-4" />
            <span>Listening & Collaboration</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {evaluation.listening_feedback}
          </p>
        </div>
      </div>

      {/* 6. Strategic Angles & Exemplar Response */}
      <div className="space-y-6">
        {evaluation.missed_opportunities && evaluation.missed_opportunities.length > 0 && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-3">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm uppercase tracking-wider">
              <Lightbulb className="w-4 h-4" />
              <span>Strategic Angles You Could Have Raised</span>
            </div>
            <ul className="space-y-2">
              {evaluation.missed_opportunities.map((m, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  <span className="text-sky-400 font-bold">›</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.example_strong_response && (
          <div className="bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl p-6 sm:p-7 space-y-3">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Sarah Jenkins' Exemplar High-Impact Response</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              How a candidate can present a compelling argument on this topic:
            </p>
            <blockquote className="border-l-2 border-purple-400/60 pl-4 py-1 italic text-xs sm:text-sm text-purple-100/90 leading-relaxed">
              "{evaluation.example_strong_response}"
            </blockquote>
          </div>
        )}
      </div>

      {/* 7. Action Plan & Assessment Limitations */}
      {evaluation.personalized_plan && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Recommended Practice & Action Plan</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Drills */}
            {evaluation.personalized_plan.drills && evaluation.personalized_plan.drills.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Actionable Improvement Drills
                </h3>
                <ul className="space-y-2">
                  {evaluation.personalized_plan.drills.map((drill: string, i: number) => (
                    <li key={i} className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                      {drill}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Next Topics */}
            {evaluation.personalized_plan.recommended_topics && evaluation.personalized_plan.recommended_topics.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-teal-400" />
                  Recommended Next Topics
                </h3>
                <ul className="space-y-2">
                  {evaluation.personalized_plan.recommended_topics.map((t: string, i: number) => (
                    <li key={i} className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {evaluation.personalized_plan.assessment_limitations && (
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 leading-relaxed">
              <strong>Assessment Limitations:</strong> {evaluation.personalized_plan.assessment_limitations}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
