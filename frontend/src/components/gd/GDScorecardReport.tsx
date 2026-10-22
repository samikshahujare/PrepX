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
} from "lucide-react";

interface GDScorecardReportProps {
  evaluation: GDEvaluation;
  session: GDSession;
  participantName?: string;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  communication_clarity: { label: "Communication Clarity", icon: "💬" },
  relevance: { label: "Relevance to Topic", icon: "🎯" },
  quality_of_reasoning: { label: "Quality of Reasoning", icon: "🧠" },
  supporting_examples: { label: "Supporting Evidence & Examples", icon: "📊" },
  critical_thinking: { label: "Critical Thinking", icon: "⚡" },
  listening_and_response: { label: "Active Listening & Response", icon: "👂" },
  constructive_collaboration: { label: "Constructive Collaboration", icon: "🤝" },
  respectful_disagreement: { label: "Respectful Disagreement", icon: "⚖️" },
  building_on_viewpoints: { label: "Synthesizing Viewpoints", icon: "🏗️" },
  conciseness: { label: "Conciseness & Structure", icon: "📐" },
  participation_balance: { label: "Participation Balance", icon: "⚖️" },
  conclusion_and_summary: { label: "Concluding & Summarization", icon: "🏁" },
};

export default function GDScorecardReport({
  evaluation,
  session,
  participantName,
}: GDScorecardReportProps) {
  const overall = evaluation.overall_score || 3.0;

  const getScoreBadge = (sc: number) => {
    if (sc >= 4.5) return { label: "Exceptional Leader", color: "text-emerald-400 bg-emerald-950/60 border-emerald-500/40" };
    if (sc >= 3.8) return { label: "Strong Contributor", color: "text-teal-300 bg-teal-950/60 border-teal-500/40" };
    if (sc >= 3.0) return { label: "Competent Participant", color: "text-blue-300 bg-blue-950/60 border-blue-500/40" };
    return { label: "Needs Practice", color: "text-amber-300 bg-amber-950/60 border-amber-500/40" };
  };

  const badge = getScoreBadge(overall);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

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
              {participantName ? `${participantName}'s Scorecard` : "Group Discussion Scorecard"}
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">Topic:</strong> {session.topic}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                {session.duration_minutes} Minutes
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Individualized Attribution
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Moderator: Sarah Jenkins
              </span>
            </div>
          </div>

          {/* Big Circular / Radial Score Box */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/80 border border-slate-800 shrink-0 text-center w-full md:w-auto min-w-[180px]">
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
        </div>
      </div>

      {/* 12 Rubric Categories Breakdown Grid */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">12-Point Core GD Competencies</h2>
          </div>
          <span className="text-xs text-slate-400">Grounded in your attributable utterances</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(evaluation.category_scores || {}).map(([key, scoreVal]) => {
            const meta = CATEGORY_META[key] || {
              label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              icon: "📌",
            };
            const num = Number(scoreVal) || 3.0;
            const pct = Math.min(100, Math.round((num / 5.0) * 100));

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
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {num.toFixed(1)}
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths and Areas for Improvement 2-Col */}
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
              <p className="text-xs text-slate-500 italic">No specific strengths recorded.</p>
            )}
          </ul>
        </div>

        {/* Areas for Improvement */}
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
            {(!evaluation.areas_for_improvement || evaluation.areas_for_improvement.length === 0) && (
              <p className="text-xs text-slate-500 italic">No specific areas for improvement recorded.</p>
            )}
          </ul>
        </div>
      </div>

      {/* Qualitative Feedback Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
            <MessageSquare className="w-4 h-4" />
            <span>Communication & Delivery</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {evaluation.communication_feedback || "Maintained clear tone and professional register throughout the session."}
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
            <Zap className="w-4 h-4" />
            <span>Quality of Reasoning</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {evaluation.reasoning_feedback || "Presented clear arguments with logical progression and real-world considerations."}
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
            <Target className="w-4 h-4" />
            <span>Listening & Collaboration</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {evaluation.listening_feedback || "Acknowledged peer perspectives before articulating counter-points or extensions."}
          </p>
        </div>
      </div>

      {/* Missed Opportunities & Suggested Stronger Response */}
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
              <span>Sarah Jenkins' Exemplar High-Impact Contribution</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              How a candidate might synthesize the discussion and introduce decisive supporting data:
            </p>
            <blockquote className="border-l-2 border-purple-400/60 pl-4 py-1 italic text-xs sm:text-sm text-purple-100/90 leading-relaxed">
              "{evaluation.example_strong_response}"
            </blockquote>
          </div>
        )}
      </div>

      {/* Action Plan & Future Drills */}
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
                  Targeted Drills
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

            {/* Recommended GD Topics */}
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
        </div>
      )}
    </div>
  );
}
