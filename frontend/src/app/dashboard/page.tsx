"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { authService } from "@/lib/auth";
import { interviewService } from "@/lib/interview";
import { gdService } from "@/lib/gd";
import { User, Resume, InterviewSession, GDSession } from "@/types";
import FeedbackReportModal from "@/components/interview/FeedbackReportModal";
import {
  BrainCircuit,
  Bot,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  Sparkles,
  User as UserIcon,
  Save,
  Loader2,
  Upload,
  FileText,
  Tag,
  ArrowRight,
  Award,
  Layers,
  Radio,
  PlusCircle,
  Link as LinkIcon,
  ShieldCheck,
  Compass,
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

  // Data Collections
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [sessionsList, setSessionsList] = useState<InterviewSession[]>([]);
  const [gdSessions, setGdSessions] = useState<GDSession[]>([]);
  const [loadingGd, setLoadingGd] = useState<boolean>(false);

  // Tab State: "overview" | "interviews" | "gd" | "resumes"
  const [activeTab, setActiveTab] = useState<"overview" | "interviews" | "gd" | "resumes">("overview");

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

        // Load existing resumes
        try {
          const resumeList = await interviewService.listResumes();
          setResumes(resumeList);
        } catch (e) {
          console.warn("Could not load resumes:", e);
        }

        // Load personal interview sessions
        try {
          const sessions = await interviewService.listInterviewSessions();
          setSessionsList(sessions);
        } catch (e) {
          console.warn("Could not load interview sessions:", e);
        }

        // Load GD sessions
        try {
          setLoadingGd(true);
          const list = await gdService.listSessions();
          setGdSessions(list);
        } catch (e) {
          console.warn("Could not load GD sessions:", e);
        } finally {
          setLoadingGd(false);
        }
      } catch (err) {
        authService.clearTokens();
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  // Handle viewing personal interview feedback report
  const handleViewSessionFeedback = async (session: InterviewSession) => {
    setIsFeedbackModalOpen(true);
    setIsLoadingFeedback(true);
    try {
      if (session.feedback && (session.feedback as any).overall_score) {
        setSelectedFeedbackReport(session.feedback as any);
      } else {
        const report = await interviewService.getSessionFeedback(session.id);
        setSelectedFeedbackReport(report);
      }
    } catch (err) {
      console.warn("Attempting fresh feedback generation for session:", err);
      try {
        const report = await interviewService.generateSessionFeedback(session.id);
        setSelectedFeedbackReport(report);
      } catch (e) {
        console.error("Failed to load feedback report:", e);
      }
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
      setQuickJoinError("Please enter a valid session code (e.g. PREPX-GD-12345) or invitation link.");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center text-white">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading PrepX Workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0d14] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Welcome, {user?.profile?.full_name || user?.email?.split("@")[0] || "Candidate"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Select Practice Arena
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Select your practice mode below to launch an AI simulation with Sarah Jenkins.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold glass-panel text-slate-200 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <UserIcon className="h-3.5 w-3.5 text-indigo-400" />
              {isEditingProfile ? "Close Profile" : "Candidate Profile"}
            </button>
          </div>
        </div>

        {/* Profile Settings Drawer (If editing) */}
        {isEditingProfile && (
          <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 mb-8 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Candidate Profile Information
            </h3>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Bio / Interview Goals</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Preparing for product company interviews"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-2 flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PHASE 1: THE TWO PRIMARY POST-LOGIN OPTIONS                  */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* OPTION A: PERSONAL INTERVIEW */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-950/80 shadow-2xl flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/50 transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-600/20 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/20">
                  <Bot className="h-6 w-6" />
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  Option A
                </span>
              </div>

              <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                Personal AI Interview
              </h2>
              <p className="text-sm font-medium text-indigo-300 mb-3">
                1-on-1 Simulation with Sarah Jenkins
              </p>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                Upload your resume and optional job description inside this workflow. Sarah conducts realistic conversational interviews with real-time voice, 3D lip-sync, adaptive follow-ups, and a 9-dimensional evidence scorecard.
              </p>

              <div className="space-y-2.5 mb-8 border-t border-white/10 pt-4">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Resume & Job Description tailored questions</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Interactive 3D Sarah Jenkins avatar with neural voice</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Role-specific & company-specific simulation modes</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Granular grammar, technical accuracy & articulation rubric</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => router.push("/interview/setup")}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <span>Launch Personal Interview</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {sessionsList.length > 0 && (
                <button
                  onClick={() => setActiveTab("interviews")}
                  className="w-full py-2.5 px-4 rounded-xl glass-panel text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Award className="h-3.5 w-3.5 text-indigo-400" />
                  <span>View Past Interview Reports ({sessionsList.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* OPTION B: GROUP DISCUSSION (GD ARENA) */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-950/40 via-slate-900/60 to-slate-950/80 shadow-2xl flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/50 transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-600/20 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="h-12 w-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/20">
                  <Users className="h-6 w-6" />
                </div>
                <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
                  Option B
                </span>
              </div>

              <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                Group Discussion Arena
              </h2>
              <p className="text-sm font-medium text-purple-300 mb-3">
                Live Multiplayer Moderated by Sarah (AI)
              </p>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                No resume or JD required. Create or join discussion rooms with friends from any browser or device. Sarah Jenkins serves as the neutral AI moderator: opening the debate, keeping order, managing time warnings, and delivering individual evidence-grounded scorecards.
              </p>

              <div className="space-y-2.5 mb-8 border-t border-white/10 pt-4">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Instant public invitation links — friends join without installing app</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Reliable Web Audio PCM mesh streaming with no local echo</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Real-time speaker-attributed transcripts with Sarah-speech filtering</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>12-rubric individual evaluation based on actual spoken contribution</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => router.push("/gd/setup")}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create Group Discussion</span>
              </button>

              {/* Quick Join Inline Form */}
              <form onSubmit={handleQuickJoin} className="flex items-center gap-2">
                <input
                  type="text"
                  value={quickJoinInput}
                  onChange={(e) => setQuickJoinInput(e.target.value)}
                  placeholder="Paste PREPX-GD-XXXXX or Invite Link..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-600/30 shrink-0 transition-all"
                >
                  Join Room
                </button>
              </form>

              {quickJoinError && (
                <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                  {quickJoinError}
                </p>
              )}

              {gdSessions.length > 0 && (
                <button
                  onClick={() => setActiveTab("gd")}
                  className="w-full py-2.5 px-4 rounded-xl glass-panel text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Users className="h-3.5 w-3.5 text-purple-400" />
                  <span>View Your GD Sessions ({gdSessions.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* PAST ACTIVITY & HISTORY TABS                                  */}
        {/* ------------------------------------------------------------- */}
        <div className="border-t border-white/10 pt-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900 border border-white/10">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "overview"
                    ? "bg-white/10 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All History
              </button>
              <button
                onClick={() => setActiveTab("interviews")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "interviews"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Personal Interviews ({sessionsList.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("gd")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "gd"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Group Discussions ({gdSessions.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("resumes")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "resumes"
                    ? "bg-slate-700 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Resumes ({resumes.length})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: PERSONAL INTERVIEW HISTORY */}
          {(activeTab === "overview" || activeTab === "interviews") && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bot className="h-4 w-4 text-indigo-400" />
                  Personal Interview Sessions
                </h3>
                <Link
                  href="/interview/setup"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <span>New Interview</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {sessionsList.length > 0 ? (
                <div className="space-y-3">
                  {sessionsList.map((s) => {
                    const feedback = s.feedback as any;
                    const hasFeedback = feedback && feedback.overall_score !== undefined;
                    const score = hasFeedback ? Number(feedback.overall_score).toFixed(1) : null;
                    const isCompleted = s.status === "completed" || s.interview_status === "completed";

                    return (
                      <div
                        key={s.id}
                        className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">{s.domain}</span>
                            {s.company && (
                              <span className="text-[11px] font-semibold text-slate-400">@ {s.company}</span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isCompleted
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                              }`}
                            >
                              {isCompleted ? "Completed" : "Active / In Progress"}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">{s.difficulty} Level</span>
                          </div>

                          <div className="flex items-center gap-4 text-[11px] text-slate-400">
                            <span>Duration: {s.duration_minutes || 30} mins</span>
                            <span>Questions: {s.questions?.length || 0}</span>
                            <span>Date: {new Date(s.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {score && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono font-bold text-xs">
                              <Award className="h-3.5 w-3.5" />
                              <span>Score: {score} / 5.0</span>
                            </div>
                          )}

                          <button
                            onClick={() => handleViewSessionFeedback(s)}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
                          >
                            <Award className="h-3.5 w-3.5 text-indigo-200" />
                            <span>{hasFeedback ? "View Feedback" : "Generate Feedback"}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => router.push(`/interview/${s.id}`)}
                            className="px-3.5 py-2 rounded-xl glass-panel text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
                          >
                            <Bot className="h-3.5 w-3.5 text-indigo-400" />
                            <span>Room</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-white/5 text-slate-400 text-xs">
                  No personal mock interviews conducted yet. Click &quot;Launch Personal Interview&quot; above to begin.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GROUP DISCUSSION HISTORY */}
          {(activeTab === "overview" || activeTab === "gd") && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  Group Discussion Sessions
                </h3>
                <Link
                  href="/gd/setup"
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                >
                  <span>Create GD</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {loadingGd ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-white/5 text-slate-400 text-xs">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-purple-400" />
                  Loading discussions...
                </div>
              ) : gdSessions.length > 0 ? (
                <div className="space-y-3">
                  {gdSessions.map((s) => {
                    const isCompleted = s.status === "completed";
                    const inProgress = s.status === "in_progress";

                    return (
                      <div
                        key={s.id}
                        className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-purple-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              {s.session_code}
                            </span>
                            <span className="text-xs font-semibold text-slate-300">{s.topic_category}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isCompleted
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : inProgress
                                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse"
                                  : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                              }`}
                            >
                              {isCompleted ? "Completed" : inProgress ? "Live Now" : "Waiting for Peers"}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-white leading-relaxed">{s.topic}</p>

                          <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-purple-400" />
                              {s.duration_minutes} mins
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-indigo-400" />
                              {s.participants?.length || 1} / {s.max_participants} Peers
                            </span>
                            <span>Created: {new Date(s.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {isCompleted ? (
                            <button
                              onClick={() => router.push(`/gd/feedback/${s.id}`)}
                              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
                            >
                              <Award className="h-3.5 w-3.5 text-purple-200" />
                              <span>View My Evaluation</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => router.push(`/gd/room/${s.session_code}`)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
                            >
                              <Users className="h-3.5 w-3.5 text-purple-200" />
                              <span>Enter GD Room</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-white/5 text-slate-400 text-xs">
                  No Group Discussion sessions recorded yet. Click &quot;Create Group Discussion&quot; above to host one.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESUME MANAGEMENT */}
          {(activeTab === "overview" || activeTab === "resumes") && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Candidate Resumes
                </h3>
              </div>

              {resumes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resumes.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                          <span className="text-xs font-bold text-white truncate">{r.original_filename}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {r.profile?.candidate_name || "Candidate"} • {(r.file_size / 1024).toFixed(1)} KB
                        </p>
                        {r.profile?.skills && r.profile.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1.5">
                            {r.profile.skills.slice(0, 6).map((sk, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[10px] border border-cyan-500/20"
                              >
                                {sk}
                              </span>
                            ))}
                            {r.profile.skills.length > 6 && (
                              <span className="text-[10px] text-slate-500 self-center">
                                +{r.profile.skills.length - 6} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-white/5 text-slate-400 text-xs">
                  No resumes uploaded yet. You can upload a resume when launching a Personal Interview.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Comprehensive Feedback Report Modal */}
      <FeedbackReportModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        report={selectedFeedbackReport}
        loading={isLoadingFeedback}
      />
    </div>
  );
}
