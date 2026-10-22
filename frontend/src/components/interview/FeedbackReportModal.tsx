"use client";

import React, { useState } from "react";
import {
  X,
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Target,
  Clock,
  Building,
  Briefcase,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Share2,
  Download,
  Flame,
} from "lucide-react";
import { InterviewFeedbackReport } from "@/types";

interface FeedbackReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: InterviewFeedbackReport | null;
  loading?: boolean;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  technical_knowledge: { label: "Technical Knowledge", icon: "🧠" },
  correctness: { label: "Correctness & Accuracy", icon: "🎯" },
  relevance: { label: "Answer Relevance", icon: "⚡" },
  completeness_and_depth: { label: "Completeness & Depth", icon: "📐" },
  problem_solving: { label: "Problem Solving", icon: "🧩" },
  project_understanding: { label: "Project & Architecture Defense", icon: "🏗️" },
  communication_and_clarity: { label: "Communication & Clarity", icon: "💬" },
  role_readiness: { label: "Target Role Readiness", icon: "🚀" },
};

export default function FeedbackReportModal({
  isOpen,
  onClose,
  report,
  loading = false,
}: FeedbackReportModalProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "categories" | "skills" | "answers" | "action_plan"
  >("overview");
  const [expandedSkillIdx, setExpandedSkillIdx] = useState<number | null>(0);
  const [expandedAnswerIdx, setExpandedAnswerIdx] = useState<number | null>(0);

  if (!isOpen) return null;

  if (loading || !report) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
        <div className="glass-panel border border-indigo-500/30 bg-slate-950 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-4 animate-spin">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Generating Evidence-Based Feedback...
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Sarah is analyzing dialogue transcripts, technical accuracy, project defense, and duration coverage against industry benchmarks.
          </p>
        </div>
      </div>
    );
  }

  const score = report.overall_score || 3.0;
  const scorePercent = Math.min(100, Math.round((score / 5.0) * 100));

  const getScoreBadge = (sc: number) => {
    if (sc >= 4.5) return { label: "Exceptional / Strong Hire", color: "from-emerald-500 to-teal-400", text: "text-emerald-400" };
    if (sc >= 4.0) return { label: "Strong Candidate", color: "from-teal-500 to-cyan-400", text: "text-teal-400" };
    if (sc >= 3.2) return { label: "Competent with Growth Gaps", color: "from-indigo-500 to-purple-400", text: "text-indigo-400" };
    if (sc >= 2.5) return { label: "Needs Technical Depth", color: "from-amber-500 to-orange-400", text: "text-amber-400" };
    return { label: "Requires Fundamental Practice", color: "from-rose-500 to-red-400", text: "text-rose-400" };
  };

  const badge = getScoreBadge(score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-panel border border-indigo-500/30 bg-slate-950 rounded-3xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Top Gradient Ambient */}
        <div className="absolute top-0 left-1/4 right-1/4 h-32 bg-indigo-600/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-slate-900/60 backdrop-blur-xl relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Comprehensive Performance Feedback Report
                </h2>
                {report.is_preliminary && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Preliminary
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                AI Recruiter Sarah Jenkins • Evaluated against real dialogue transcripts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 px-5 pt-3 border-b border-white/10 bg-slate-950/80 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: "overview", label: "Overview & Score", icon: Award },
            { id: "categories", label: "8 Competency Scores", icon: Target },
            { id: "skills", label: "Skills to Improve", icon: TrendingUp },
            { id: "answers", label: "Model Answers", icon: Lightbulb },
            { id: "action_plan", label: "Action Plan", icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap border-b-2 ${
                  isActive
                    ? "text-indigo-400 border-indigo-500 bg-indigo-500/10"
                    : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-slate-200 text-xs sm:text-sm">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Score Hero Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-purple-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-center gap-6 shadow-xl">
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div className="relative h-28 w-28 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="stroke-slate-800"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={264}
                        strokeDashoffset={264 - (264 * scorePercent) / 100}
                        strokeLinecap="round"
                        className={`transition-all duration-1000 ${badge.text}`}
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold text-white tracking-tight">
                        {score.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">out of 5.0</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-xs font-bold mb-2">
                    <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${badge.color}`} />
                    <span className={badge.text}>{badge.label}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                    Overall Interview Performance
                  </h3>
                  <p className="text-slate-300 leading-relaxed text-xs sm:text-sm">
                    {report.overall_explanation}
                  </p>
                </div>
              </div>

              {/* Interview Summary Grid */}
              {report.interview_summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Role</span>
                    <span className="text-xs font-semibold text-white truncate block">
                      {report.interview_summary.target_role || "Engineering"}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Company Context</span>
                    <span className="text-xs font-semibold text-white truncate block">
                      {report.interview_summary.company || "General Tech"}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Duration Elapsed</span>
                    <span className="text-xs font-semibold text-indigo-400 block">
                      {report.interview_summary.actual_elapsed_minutes || 0}m / {report.interview_summary.configured_duration_minutes || report.interview_summary.duration_minutes || 30}m
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">QA Turns Answered</span>
                    <span className="text-xs font-semibold text-emerald-400 block">
                      {report.interview_summary.questions_completed || 0} Responses
                    </span>
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses 2-Column Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="h-4 w-4" />
                    Key Demonstrated Strengths
                  </div>
                  <ul className="space-y-2">
                    {(report.strengths || []).map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses & Mistakes */}
                <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4" />
                    Gaps & Areas to Strengthen
                  </div>
                  <ul className="space-y-2">
                    {(report.weaknesses_and_mistakes || []).map((w, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Project & Resume Defense Evaluation */}
              {report.project_and_resume_evaluation && (
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                    <Briefcase className="h-4 w-4" />
                    Project Defense & Experience Evaluation
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {report.project_and_resume_evaluation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 8 CATEGORY SCORES */}
          {activeTab === "categories" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs text-slate-400">
                Granular evidence scoring across all 8 core competencies on a 1.0 to 5.0 scale.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(report.category_scores || {}).map(([key, catScore]) => {
                  const meta = CATEGORY_LABELS[key] || { label: key.replace(/_/g, " "), icon: "📊" };
                  const assessment = report.category_assessments?.[key] || "";
                  const catPercent = Math.min(100, Math.round(((catScore || 3.0) / 5.0) * 100));

                  const getBarColor = (s: number) => {
                    if (s >= 4.2) return "bg-emerald-500";
                    if (s >= 3.6) return "bg-indigo-500";
                    if (s >= 2.8) return "bg-amber-500";
                    return "bg-rose-500";
                  };

                  return (
                    <div
                      key={key}
                      className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5 hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{meta.icon}</span>
                          <span className="text-xs font-bold text-white capitalize">
                            {meta.label}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-white font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-white/5">
                          {Number(catScore).toFixed(1)} / 5.0
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getBarColor(Number(catScore))}`}
                          style={{ width: `${catPercent}%` }}
                        />
                      </div>

                      {assessment && (
                        <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                          {assessment}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SKILLS TO IMPROVE */}
          {activeTab === "skills" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs text-slate-400">
                Targeted technical skills diagnosed from candidate responses with comprehensive learning guidance.
              </p>

              <div className="space-y-3">
                {(report.skills_to_improve || []).map((skillItem, idx) => {
                  const isExpanded = expandedSkillIdx === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => setExpandedSkillIdx(isExpanded ? null : idx)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-white block">
                              {skillItem.skill}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {skillItem.what_to_learn}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              skillItem.importance === "High"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            }`}
                          >
                            {skillItem.importance} Priority
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-1 border-t border-white/5 space-y-3 text-xs bg-slate-950/40">
                          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                            <span className="font-bold text-indigo-400 block mb-1">
                              Why it matters in production:
                            </span>
                            <p className="text-slate-300 leading-relaxed">
                              {skillItem.why_it_matters}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20">
                            <span className="font-bold text-amber-400 block mb-1">
                              Observed gap in interview:
                            </span>
                            <p className="text-slate-300 leading-relaxed">
                              {skillItem.what_was_misunderstood}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                            <span className="font-bold text-emerald-400 block mb-1">
                              Stronger response recommendation:
                            </span>
                            <p className="text-slate-300 leading-relaxed">
                              {skillItem.stronger_answer_guide}
                            </p>
                          </div>

                          {skillItem.suggested_practice_question && (
                            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20">
                              <span className="font-bold text-purple-400 block mb-1">
                                Recommended practice question:
                              </span>
                              <p className="text-slate-300 leading-relaxed italic">
                                &quot;{skillItem.suggested_practice_question}&quot;
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: BETTER ANSWER GUIDANCE */}
          {activeTab === "answers" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs text-slate-400">
                Side-by-side comparison of candidate responses against production-grade model answers.
              </p>

              <div className="space-y-4">
                {(report.better_answer_guidance || []).map((ans, idx) => {
                  const isExpanded = expandedAnswerIdx === idx;
                  const candidateText = ans.candidate_answer || ans.candidate_answer_summary || "Minimal detail provided";
                  const modelText = ans.recommended_model_answer || ans.strong_example_answer || ans.model_answer_structure || "Articulate architectural trade-offs, metrics, and bottlenecks.";

                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedAnswerIdx(isExpanded ? null : idx)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono text-xs font-bold">
                            Q{idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-white">
                            {ans.question}
                          </span>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-0 space-y-3 text-xs border-t border-white/5 bg-slate-950/40">
                          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
                            <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Your Spoken Answer:
                            </span>
                            <p className="text-slate-300 leading-relaxed italic">
                              &quot;{candidateText}&quot;
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30">
                            <span className="font-bold text-indigo-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              Recommended Model Response:
                            </span>
                            <p className="text-slate-200 leading-relaxed">
                              {modelText}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: ACTION PLAN */}
          {activeTab === "action_plan" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs text-slate-400">
                Actionable next steps to prepare you for staff and senior level technical rounds.
              </p>

              <div className="space-y-3">
                {(report.action_plan || []).map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex items-start gap-3.5"
                  >
                    <span className="h-7 w-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                      {idx + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed pt-0.5">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 flex items-center justify-between shrink-0 bg-slate-900/60 backdrop-blur-xl">
          <div className="text-[11px] text-slate-400">
            Report stored permanently in candidate profile.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              Done & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
