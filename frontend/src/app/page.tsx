import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Sparkles, Bot, Users, Award, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col glow-gradient">
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 flex flex-col items-center text-center">
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel text-xs font-semibold text-purple-300 border border-purple-500/30 mb-8 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span>Next-Generation Career Preparation</span>
        </div>

        {/* Requested Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gradient max-w-4xl leading-[1.12]">
          Practice Smarter. Interview with Confidence.
        </h1>

        {/* Requested Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl leading-relaxed">
          AI-powered mock interviews and live group discussions to help you perform at your best.
        </p>

        {/* Two Prominent CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <Link
            href="/interview/setup"
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-base shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
          >
            <span>Start Interview</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/gd/setup"
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl glass-panel text-slate-200 hover:text-white hover:bg-white/10 font-semibold text-base border border-purple-500/30 shadow-lg shadow-purple-950/20 transition-all hover:scale-[1.02]"
          >
            <Users className="h-4 w-4 text-purple-400" />
            <span>Join a Group</span>
          </Link>
        </div>

        {/* Concise Feature Highlights */}
        <div className="mt-28 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full text-left">
          {/* Feature 1 */}
          <div className="glass-panel p-8 rounded-2xl glass-panel-hover flex flex-col border border-white/10">
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
              <Bot className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">1-on-1 AI Interviewer</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Experience face-to-face interview simulations with Sarah Jenkins, tailored dynamically to your resume, role, and industry.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-panel p-8 rounded-2xl glass-panel-hover flex flex-col border border-white/10">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Group Discussion Arena</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Deliberate on trending topics in live multiplayer rooms with autonomous AI moderation, turn tracking, and intervention.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-panel p-8 rounded-2xl glass-panel-hover flex flex-col border border-white/10">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
              <Award className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Actionable Feedback</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Receive structured evaluation rubrics assessing communication clarity, technical depth, and actionable growth opportunities.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

