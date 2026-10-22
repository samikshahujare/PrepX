"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { authService } from "@/lib/auth";
import { gdService } from "@/lib/gd";
import { GDSession, GDTopicData } from "@/types";
import {
  Users,
  Sparkles,
  Clock,
  Share2,
  Copy,
  Check,
  Send,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Compass,
  FileText,
  ShieldCheck,
  Radio,
} from "lucide-react";

const CATEGORIES = [
  { id: "technology_ai", label: "Technology & AI", icon: Sparkles, desc: "AI ethics, automation, frontier tech impact" },
  { id: "business_economy", label: "Business & Economy", icon: Compass, desc: "Market shifts, startups, global trade & fiscal policies" },
  { id: "social_ethical", label: "Social & Ethics", icon: Users, desc: "Digital privacy, equity, corporate governance" },
  { id: "workplace_management", label: "Workplace & Leadership", icon: FileText, desc: "Remote work culture, talent strategy & leadership" },
  { id: "current_affairs", label: "Current Affairs", icon: Radio, desc: "Macro trends and sustainable global development" },
  { id: "role_specific", label: "Role-Specific Industry", icon: ShieldCheck, desc: "Specialized engineering & product trade-offs" },
];

const DURATION_OPTIONS = [10, 15, 20, 30];
const PARTICIPANT_OPTIONS = [2, 3, 4, 5, 6, 8];

export default function GDSetupPage() {
  const router = useRouter();

  // Authentication State
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form State
  const [topicMode, setTopicMode] = useState<"ai" | "manual">("ai");
  const [category, setCategory] = useState("technology_ai");
  const [jdContext, setJdContext] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [prepTimeSeconds, setPrepTimeSeconds] = useState(60);

  // Manual Topic State
  const [customTopic, setCustomTopic] = useState("");
  const [customContext, setCustomContext] = useState("");

  // AI Generated Topic State
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [generatedTopic, setGeneratedTopic] = useState<GDTopicData | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);

  // Session Creation State
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [createdSession, setCreatedSession] = useState<GDSession | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push("/login?redirect=/gd/setup");
      return;
    }
    setLoadingInitial(false);
  }, [router]);

  // AI Topic Generator Trigger
  const handleGenerateTopic = async () => {
    setIsGeneratingTopic(true);
    setTopicError(null);
    try {
      const topicData = await gdService.generateTopic({
        category,
        role_context: jdContext.trim() || undefined,
      });
      setGeneratedTopic(topicData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate topic with Sarah";
      setTopicError(msg);
    } finally {
      setIsGeneratingTopic(false);
    }
  };

  // Submit Session Creation
  const handleCreateSession = async () => {
    setErrorMsg(null);

    const finalTopic = topicMode === "ai"
      ? (generatedTopic?.topic || (category ? `Group Discussion on ${category.replace("_", " ")}` : "Emerging Global Technology Trends"))
      : customTopic.trim();

    if (!finalTopic) {
      setErrorMsg("Please provide or generate a discussion topic before continuing.");
      return;
    }

    const finalContext = topicMode === "ai"
      ? (generatedTopic?.briefing || "")
      : customContext.trim();

    setIsCreatingSession(true);
    try {
      const session = await gdService.createSession({
        topic: finalTopic,
        topic_category: category,
        topic_context: finalContext,
        duration_minutes: durationMinutes,
        max_participants: maxParticipants,
      });

      setCreatedSession(session);

      // Fetch or build the canonical invitation URL
      try {
        const inv = await gdService.createInvitation(session.id);
        const configuredPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
        let fullUrl = inv.join_url;
        if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
          if (configuredPublicAppUrl && (fullUrl.includes("localhost") || fullUrl.includes("127.0.0.1"))) {
            const urlPath = fullUrl.replace(/^https?:\/\/[^/]+/, "");
            fullUrl = `${configuredPublicAppUrl}${urlPath}`;
          }
        } else {
          const baseOrigin = configuredPublicAppUrl || (typeof window !== "undefined" ? window.location.origin : "");
          fullUrl = `${baseOrigin}${fullUrl.startsWith("/") ? "" : "/"}${fullUrl}`;
        }
        setInvitationUrl(fullUrl);
      } catch {
        // Fallback invitation URL using session code
        const baseOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");
        setInvitationUrl(`${baseOrigin}/gd/join/${session.session_code}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create discussion session";
      setErrorMsg(msg);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleCopyLink = () => {
    if (!invitationUrl) return;
    navigator.clipboard.writeText(invitationUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!createdSession || !invitationUrl) return;
    const msg = `Join our PrepX AI-moderated Group Discussion!\n\nTopic: ${createdSession.topic}\nDuration: ${createdSession.duration_minutes} minutes\nModerator: Sarah Jenkins (AI)\n\nJoin link: ${invitationUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleEmailShare = () => {
    if (!createdSession || !invitationUrl) return;
    const subject = `Invitation: PrepX Group Discussion on "${createdSession.topic}"`;
    const body = `Hi,\n\nYou have been invited to an intelligent Group Discussion session on PrepX.\n\nTopic: ${createdSession.topic}\nDuration: ${createdSession.duration_minutes} Minutes\nModerator: Sarah Jenkins (AI Evaluation)\n\nJoin here: ${invitationUrl}\n\nSee you in the arena!`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb / Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
            <Users className="w-4 h-4" />
            <span>Group Discussion Arena Setup</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Configure Your <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">GD Session</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-2xl">
            Sarah Jenkins will act as your neutral AI moderator: opening the debate, keeping order, managing time warnings, and delivering individualized evidence-grounded scorecards for every participant.
          </p>
        </div>

        {/* Modal / Dialog when Session is Created */}
        {createdSession && (
          <div className="mb-10 bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Discussion Room Ready!</h3>
                <p className="text-sm text-slate-300 mt-1">
                  Session Code: <span className="font-mono font-bold text-emerald-300 px-2 py-0.5 bg-emerald-950/60 rounded border border-emerald-500/30">{createdSession.session_code}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-6">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Topic</p>
              <p className="text-base font-semibold text-white">{createdSession.topic}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-400" /> {createdSession.duration_minutes} minutes</span>
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-400" /> Max {createdSession.max_participants} Participants</span>
                <span className="flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-emerald-400" /> AI Moderator Active</span>
              </div>
            </div>

            {/* Sharing Bar */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Invite Participants
                </label>
                {(invitationUrl.includes("localhost") || invitationUrl.includes("127.0.0.1")) ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    Localhost Only (Dev Mode)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Public Shareable Link
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <input
                  type="text"
                  readOnly
                  value={invitationUrl}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-mono text-emerald-300 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? "Copied!" : (invitationUrl.includes("localhost") || invitationUrl.includes("127.0.0.1")) ? "Copy Local Link" : "Copy Invite Link"}
                </button>
              </div>

              {(invitationUrl.includes("localhost") || invitationUrl.includes("127.0.0.1")) && (
                <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-300">Localhost Invitation Notice</p>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      This link uses <code className="text-amber-100 bg-amber-900/40 px-1 py-0.5 rounded">localhost</code> and will only work on this computer. For participants on other devices or external networks to join, configure <code className="text-amber-100 bg-amber-900/40 px-1 py-0.5 rounded">NEXT_PUBLIC_APP_URL</code> in your frontend environment or launch a public secure tunnel (e.g. ngrok / Cloudflare Tunnel).
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="px-3.5 py-2 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/30 text-xs font-medium flex items-center gap-2 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Share via WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleEmailShare}
                  className="px-3.5 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-medium flex items-center gap-2 transition"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Share via Email
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => router.push(`/gd/room/${createdSession.session_code}`)}
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
              >
                Enter Discussion Room Now
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedSession(null);
                  setInvitationUrl("");
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Create Another Session
              </button>
            </div>
          </div>
        )}

        {/* Configuration Grid */}
        {!createdSession && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Topic Selection */}
            <div className="lg:col-span-2 space-y-6">
              {/* Topic Mode Toggle */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Discussion Topic Selection
                  </h2>
                  <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setTopicMode("ai")}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        topicMode === "ai"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      AI Curated (Sarah)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopicMode("manual")}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        topicMode === "manual"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Custom Topic
                    </button>
                  </div>
                </div>

                {/* AI Topic Mode */}
                {topicMode === "ai" ? (
                  <div className="space-y-4">
                    <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Choose Topic Domain
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = category === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                              isSelected
                                ? "bg-emerald-950/40 border-emerald-500/50 shadow-sm shadow-emerald-500/10"
                                : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700"
                            }`}
                          >
                            <div className={`p-2 rounded-lg mt-0.5 ${isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${isSelected ? "text-emerald-300" : "text-white"}`}>
                                {cat.label}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                {cat.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Optional Job Description / Company Context */}
                    <div className="pt-2">
                      <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Target Role or Company Context (Optional)</span>
                        <span className="text-[11px] text-slate-500">Tailors topics to your industry</span>
                      </label>
                      <textarea
                        rows={2}
                        value={jdContext}
                        onChange={(e) => setJdContext(e.target.value)}
                        placeholder="e.g. Senior Frontend Engineer at Atlassian, or Product Management campus recruit..."
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isGeneratingTopic}
                      onClick={handleGenerateTopic}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {isGeneratingTopic ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          Consulting Sarah Jenkins for Topic...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          {generatedTopic ? "Regenerate Another Topic" : "Generate Dynamic Topic with Sarah"}
                        </>
                      )}
                    </button>

                    {topicError && (
                      <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-lg">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{topicError}</span>
                      </div>
                    )}

                    {/* Generated Topic Card Preview */}
                    {generatedTopic && (
                      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-2 mt-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Generated Topic Ready</span>
                        </div>
                        <h4 className="text-sm font-bold text-white">{generatedTopic.topic}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{generatedTopic.briefing}</p>
                        {generatedTopic.key_perspectives && generatedTopic.key_perspectives.length > 0 && (
                          <div className="pt-2">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Key Debating Angles:</p>
                            <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                              {generatedTopic.key_perspectives.map((pt: string, i: number) => (
                                <li key={i}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Manual Topic Mode */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                        Discussion Topic *
                      </label>
                      <input
                        type="text"
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder="e.g. Can Central Bank Digital Currencies replace physical cash?"
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                        Background Context & Problem Statement (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={customContext}
                        onChange={(e) => setCustomContext(e.target.value)}
                        placeholder="Provide background context or constraints for participants to discuss..."
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 Col: Session Parameters & Launch */}
            <div className="space-y-6">
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 space-y-5">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Arena Parameters
                </h3>

                {/* Duration Pills */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    Discussion Duration
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDurationMinutes(d)}
                        className={`py-2 text-xs font-bold rounded-lg border transition ${
                          durationMinutes === d
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Participant Count */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    Max Participants
                  </label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {PARTICIPANT_OPTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMaxParticipants(p)}
                        className={`py-2 text-xs font-bold rounded-lg border transition ${
                          maxParticipants === p
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preparation Time */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    Topic Preparation Time
                  </label>
                  <select
                    value={prepTimeSeconds}
                    onChange={(e) => setPrepTimeSeconds(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={0}>No prep (Start immediately)</option>
                    <option value={30}>30 seconds preparation</option>
                    <option value={60}>60 seconds (Recommended)</option>
                    <option value={90}>90 seconds in-depth</option>
                  </select>
                </div>

                {/* Rules & Moderation Notice */}
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Sarah Jenkins Rules</span>
                  </div>
                  <p>• Sarah introduces the topic and enforces balanced participation.</p>
                  <p>• Cooldown rates prevent moderator interruption storms.</p>
                  <p>• Live transcript automatically attributes speech per participant.</p>
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Launch Button */}
                <button
                  type="button"
                  disabled={isCreatingSession}
                  onClick={handleCreateSession}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Arena...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      Create GD Arena & Invite
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
