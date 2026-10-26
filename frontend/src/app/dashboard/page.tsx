"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { authService } from "@/lib/auth";
import { interviewService } from "@/lib/interview";
import { gdService } from "@/lib/gd";
import { User, InterviewSession, GDSession } from "@/types";
import FeedbackReportModal from "@/components/interview/FeedbackReportModal";
import {
  Bot,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  User as UserIcon,
  Save,
  Loader2,
  ArrowRight,
  Award,
  PlusCircle,
  ShieldCheck,
  ChevronRight,
  Calendar,
  X,
  Compass,
  ArrowUpRight,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();

  // Authentication & User State
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile Drawer State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Data Collections for Recent Practice
  const [sessionsList, setSessionsList] = useState<InterviewSession[]>([]);
  const [gdSessions, setGdSessions] = useState<GDSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // All History Modal State
  const [isAllHistoryOpen, setIsAllHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<"all" | "interviews" | "gd">("all");

  // Feedback Modal State for Personal Interviews
  const [selectedFeedbackReport, setSelectedFeedbackReport] = useState<any>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Quick Join State for GD
  const [quickJoinInput, setQuickJoinInput] = useState("");
  const [quickJoinError, setQuickJoinError] = useState<string | null>(null);

  // Load user data, past interviews, and past GD sessions
  useEffect(() => {
    async function init() {
      if (!authService.isAuthenticated()) {
        router.push("/login?redirect=/dashboard");
        return;
      }
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
        setFullName(userData.profile?.full_name || "");
        setTargetDomain(userData.profile?.target_domain || "Software Engineering");
        setExperienceLevel(userData.profile?.experience_level || "Fresher / Entry Level");
        setBio(userData.profile?.bio || "");

        // Load recent interview sessions
        try {
          const sessions = await interviewService.listInterviewSessions();
          setSessionsList(sessions);
        } catch (e) {
          console.warn("Could not load interview sessions:", e);
        }

        // Load recent GD sessions
        try {
          const gdList = await gdService.listSessions();
          setGdSessions(gdList);
        } catch (e) {
          console.warn("Could not load GD sessions:", e);
        }
      } catch (err: any) {
        console.error("Dashboard initialization error:", err);
        setHistoryError("Could not load recent practice data.");
      } finally {
        setLoading(false);
        setLoadingHistory(false);
      }
    }
    init();
  }, [router]);

  // Handler to view personal interview feedback report modal
  const handleViewInterviewReport = async (session: InterviewSession) => {
    setIsLoadingFeedback(true);
    setIsFeedbackModalOpen(true);
    try {
      const report = await interviewService.generateSessionFeedback(session.id);
      setSelectedFeedbackReport(report);
    } catch (e) {
      console.error("Failed to load feedback report:", e);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  // Profile update handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await authService.updateProfile({
        full_name: fullName,
        target_domain: targetDomain,
        experience_level: experienceLevel,
        bio: bio,
      });
      const updatedUser = await authService.getCurrentUser();
      setUser(updatedUser);
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick join GD discussion handler
  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickJoinError(null);
    const trimmed = quickJoinInput.trim();
    if (!trimmed) {
      setQuickJoinError("Enter a session code (e.g. PREPX-GD-12345) or invitation link.");
      return;
    }

    if (trimmed.includes("/gd/join/")) {
      const token = trimmed.split("/gd/join/")[1]?.split("?")[0];
      if (token) {
        router.push(`/gd/join/${token}`);
        return;
      }
    }

    if (trimmed.toUpperCase().startsWith("PREPX-GD-")) {
      router.push(`/gd/room/${trimmed.toUpperCase()}`);
      return;
    }

    router.push(`/gd/room/${trimmed}`);
  };

  // Format combined recent practice sessions (up to 3 items)
  interface UnifiedPracticeItem {
    id: string;
    type: "interview" | "gd";
    title: string;
    subtitle: string;
    date: string;
    rawDate: number;
    status: string;
    score?: number;
    sessionRef: any;
  }

  const unifiedRecentPractice: UnifiedPracticeItem[] = [
    ...sessionsList.map((s) => ({
      id: s.id,
      type: "interview" as const,
      title: s.target_role || "Technical & Behavioral Interview",
      subtitle: s.company ? `Target: ${s.company}` : "Personal AI Simulation",
      date: new Date(s.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      rawDate: new Date(s.created_at).getTime(),
      status: s.status,
      score: (s.feedback as any)?.overall_score,
      sessionRef: s,
    })),
    ...gdSessions.map((g) => ({
      id: g.id,
      type: "gd" as const,
      title: g.topic || "Group Discussion Arena",
      subtitle: `Code: ${g.session_code} • ${g.duration_minutes}m`,
      date: new Date(g.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      rawDate: new Date(g.created_at).getTime(),
      status: g.status,
      sessionRef: g,
    })),
  ].sort((a, b) => b.rawDate - a.rawDate);

  const displayRecentPractice = unifiedRecentPractice.slice(0, 3);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center text-white">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-sm text-slate-400">Loading your PrepX Arena...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0d14] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Modern AI SaaS Hero Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Welcome, {user?.profile?.full_name || user?.email?.split("@")[0] || "Candidate"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Select Practice Mode
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Choose your practice simulation format below to start training with Sarah Jenkins.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900/80 border border-white/10 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <UserIcon className="h-3.5 w-3.5 text-indigo-400" />
              <span>{isEditingProfile ? "Close Profile" : "Candidate Profile"}</span>
            </button>
          </div>
        </div>

        {/* Candidate Profile Drawer (If opened) */}
        {isEditingProfile && (
          <div className="bg-[#111726]/90 border border-indigo-500/30 rounded-2xl p-6 mb-8 shadow-2xl backdrop-blur-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                Candidate Profile Settings
              </h3>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Engineering Domain</label>
                <input
                  type="text"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  placeholder="e.g. Full Stack Engineering, Data Science"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="Fresher / Entry Level">Fresher / Entry Level</option>
                  <option value="1-3 Years">1-3 Years</option>
                  <option value="3-5 Years">3-5 Years</option>
                  <option value="5+ Years (Senior)">5+ Years (Senior)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Interview Goal</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Preparing for tech company interviews"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-2 flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-2 transition"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CORE SECTION: TWO EQUALLY PROMINENT PRIMARY CHOICES           */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-12">
          {/* CARD 1: PERSONAL INTERVIEW */}
          <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/30 via-slate-900/70 to-[#0c101a] p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-600/20 transition-all" />

            <div>
              {/* Header Bar */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-md shadow-indigo-500/20">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    1-on-1 Simulation
                  </span>
                </div>

                {/* Sarah Jenkins Avatar Badge */}
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
                  <div className="h-5 w-5 rounded-full overflow-hidden bg-indigo-950 border border-indigo-500/40 relative">
                    <Image
                      src="/avatars/sarah-clean.png"
                      alt="Sarah Jenkins"
                      width={20}
                      height={20}
                      className="object-cover"
                    />
                  </div>
                  <span className="font-semibold text-slate-200">Sarah Jenkins</span>
                </div>
              </div>

              {/* Title & Concise Description */}
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
                Personal Interview
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                Practice realistic 1-on-1 technical and behavioral interviews tailored to your resume and target role, featuring interactive voice, 3D facial animation, and a comprehensive evaluation scorecard.
              </p>

              {/* Modern Feature Chips */}
              <div className="space-y-2.5 mb-8 border-t border-white/10 pt-5">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Resume & job description tailored questions</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Interactive 3D Sarah avatar with synchronized voice</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Granular 9-dimension scoring and transcript analysis</span>
                </div>
              </div>
            </div>

            {/* Clear Primary CTA */}
            <div className="pt-2">
              <button
                onClick={() => router.push("/interview/setup")}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <span>Start Interview</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* CARD 2: GROUP DISCUSSION ARENA */}
          <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-950/30 via-slate-900/70 to-[#0c101a] p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-600/20 transition-all" />

            <div>
              {/* Header Bar */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-md shadow-purple-500/20">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
                    Multiplayer Arena
                  </span>
                </div>

                {/* Moderator Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-purple-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>AI Moderator</span>
                </div>
              </div>

              {/* Title & Concise Description */}
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
                GD Arena
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                Practice group discussions with peers and Sarah Jenkins as your AI moderator. Discuss trending topics in real time, take turns speaking, and receive individualized, evidence-grounded performance feedback.
              </p>

              {/* Modern Feature Chips */}
              <div className="space-y-2.5 mb-8 border-t border-white/10 pt-5">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Autonomous AI moderation with silence intervention</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Instant shareable invitation links for group practice</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Separate scorecards based strictly on your own speech</span>
                </div>
              </div>
            </div>

            {/* Clear Primary CTA & Compact Quick Join */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => router.push("/gd/setup")}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <span>Enter GD Arena</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {/* Inline Quick Join for Existing Session */}
              <form onSubmit={handleQuickJoin} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={quickJoinInput}
                  onChange={(e) => setQuickJoinInput(e.target.value)}
                  placeholder="Enter session code (e.g. PREPX-GD-XXXXX)..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-white/10 shrink-0 transition"
                >
                  Join
                </button>
              </form>

              {quickJoinError && (
                <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                  {quickJoinError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* RECENT PRACTICE SECTION (Concise, authentic, up to 3 items)  */}
        {/* ------------------------------------------------------------- */}
        <section className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Recent Practice
              </h3>
              {unifiedRecentPractice.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px] font-mono font-semibold">
                  {unifiedRecentPractice.length}
                </span>
              )}
            </div>

            {unifiedRecentPractice.length > 0 && (
              <button
                onClick={() => setIsAllHistoryOpen(true)}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
              >
                <span>View all history</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Loading State */}
          {loadingHistory && (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mb-2 text-indigo-400" />
              <p className="text-xs">Loading practice history...</p>
            </div>
          )}

          {/* Error State */}
          {historyError && !loadingHistory && (
            <div className="py-6 text-center text-xs text-slate-400">
              {historyError}
            </div>
          )}

          {/* Empty State */}
          {!loadingHistory && !historyError && displayRecentPractice.length === 0 && (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <Compass className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                No practice sessions recorded yet.
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Start a personal interview or create a group discussion above to see your scores and feedback here.
              </p>
            </div>
          )}

          {/* Recent Practice List */}
          {!loadingHistory && displayRecentPractice.length > 0 && (
            <div className="space-y-3">
              {displayRecentPractice.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        item.type === "interview"
                          ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                          : "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                      }`}
                    >
                      {item.type === "interview" ? (
                        <Bot className="h-4 w-4" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate max-w-md">
                          {item.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            item.type === "interview"
                              ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                              : "bg-purple-950 text-purple-300 border border-purple-800"
                          }`}
                        >
                          {item.type === "interview" ? "Personal" : "GD Arena"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.subtitle} • {item.date}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Score */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    {item.score !== undefined && (
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-lg">
                        {item.score.toFixed(1)} / 5.0
                      </span>
                    )}

                    {item.type === "interview" ? (
                      <button
                        onClick={() => handleViewInterviewReport(item.sessionRef)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition flex items-center gap-1"
                      >
                        <span>View Feedback</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <Link
                        href={`/gd/feedback/${item.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition flex items-center gap-1"
                      >
                        <span>View Scorecard</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* ALL PRACTICE SESSIONS MODAL (Clean, isolated, not on landing) */}
      {/* ------------------------------------------------------------- */}
      {isAllHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">All Practice History</h3>
              </div>
              <button
                onClick={() => setIsAllHistoryOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-5 pt-3 pb-2 border-b border-slate-800 flex gap-2">
              <button
                onClick={() => setHistoryTab("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  historyTab === "all"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                All ({unifiedRecentPractice.length})
              </button>
              <button
                onClick={() => setHistoryTab("interviews")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  historyTab === "interviews"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Personal Interviews ({sessionsList.length})
              </button>
              <button
                onClick={() => setHistoryTab("gd")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  historyTab === "gd"
                    ? "bg-purple-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                GD Arena ({gdSessions.length})
              </button>
            </div>

            {/* Modal List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {unifiedRecentPractice
                .filter((item) =>
                  historyTab === "all" ? true : item.type === (historyTab === "interviews" ? "interview" : "gd")
                )
                .map((item) => (
                  <div
                    key={`modal-${item.type}-${item.id}`}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.subtitle} • {item.date}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.score !== undefined && (
                        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                          {item.score.toFixed(1)} / 5.0
                        </span>
                      )}
                      {item.type === "interview" ? (
                        <button
                          onClick={() => {
                            setIsAllHistoryOpen(false);
                            handleViewInterviewReport(item.sessionRef);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-semibold transition"
                        >
                          Feedback
                        </button>
                      ) : (
                        <Link
                          href={`/gd/feedback/${item.id}`}
                          className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white text-xs font-semibold transition"
                        >
                          Scorecard
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Personal Interview Feedback Modal Component */}
      <FeedbackReportModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        report={selectedFeedbackReport}
        loading={isLoadingFeedback}
      />
    </div>
  );
}
