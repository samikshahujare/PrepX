import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Sparkles, Bot, Users, Activity, FileText, CheckCircle2, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col glow-gradient">
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel text-xs font-medium text-indigo-300 border border-indigo-500/30 mb-8 shadow-inner">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          <span>Intelligent Interview & Group Discussion Simulation</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gradient max-w-4xl leading-[1.15]">
          Master Real Tech Interviews with an AI Female Avatar & Live GD Arena
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed">
          Experience realistic face-to-face AI mock interviews, real-time voice interaction, adaptive follow-ups, and multiplayer Group Discussions moderated by AI.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/register"
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]"
          >
            Start Free Practice
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl glass-panel text-slate-200 hover:text-white hover:bg-white/5 font-semibold text-base transition-colors"
          >
            Sign In to Dashboard
          </Link>
        </div>

        {/* Core Pillars Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-left">
          {/* Pillar 1 */}
          <div className="glass-panel p-8 rounded-2xl glass-panel-hover flex flex-col">
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Interactive AI Female Interviewer</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
              Natural conversational speech, lip-sync video avatar, and intelligent follow-up questioning tailored dynamically to your resume and targeted company.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Whisper STT + Neural Voice Synthesis</span>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="glass-panel p-8 rounded-2xl glass-panel-hover flex flex-col">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Live Multiplayer GD Arena</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
              Create instant group discussion rooms, invite peers via shareable links, and let an autonomous AI Moderator facilitate and judge teamwork and leadership.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Multi-user Audio Mesh + AI Scoring</span>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="glass-panel p-8 rounded-2xl glass-panel-hover flex flex-col">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Deep Response & Grammar Analytics</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
              Receive granular feedback on technical accuracy, articulation, vocabulary, speaking pace, and grammar corrections with actionable improvement tips.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Multi-Dimensional Scorecard</span>
            </div>
          </div>
        </div>

        {/* Roadmap Preview */}
        <div className="mt-20 w-full glass-panel p-8 rounded-2xl text-left">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-6 mb-6">
            <div>
              <h4 className="text-lg font-bold text-white">System Architecture & Phase Breakdown</h4>
              <p className="text-xs text-slate-400">Modular Monolith powered by FastAPI & PostgreSQL</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Phase 1 Live
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { phase: "P1", name: "Foundation & Auth", status: "Active", done: true },
              { phase: "P2", name: "Resume & Questions", status: "Next", done: false },
              { phase: "P3", name: "AI Female Interviewer", status: "Upcoming", done: false },
              { phase: "P4", name: "Response & Grammar", status: "Upcoming", done: false },
              { phase: "P5", name: "GD Multiplayer Arena", status: "Upcoming", done: false },
              { phase: "P6", name: "Dashboard & Hardening", status: "Upcoming", done: false },
            ].map((item, idx) => (
              <div key={idx} className={`p-3 rounded-xl border ${item.done ? "bg-indigo-950/40 border-indigo-500/40" : "bg-white/[0.02] border-white/5"}`}>
                <span className="text-[11px] font-bold text-indigo-400">{item.phase}</span>
                <p className="text-xs font-semibold text-slate-200 mt-1 line-clamp-1">{item.name}</p>
                <span className={`text-[10px] inline-block mt-2 font-medium ${item.done ? "text-emerald-400" : "text-slate-500"}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
