"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { GDSession } from "@/types";
import {
  Users,
  Sparkles,
  ArrowRight,
  PlusCircle,
  Clock,
  Award,
  Layers,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface GDArenaCardProps {
  sessions: GDSession[];
  loading: boolean;
  onRefresh: () => void;
}

export default function GDArenaCard({ sessions, loading, onRefresh }: GDArenaCardProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* GD Hero Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/60 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-lg font-bold text-white">AI-Moderated Group Discussion Arena</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-semibold">
                Multiplayer Simulation
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Create instant group discussion rooms, invite peers via secure links or WhatsApp, and deliberate on realistic technical or business topics moderated autonomously by Sarah Jenkins. Receive individualized 12-rubric evaluations.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => router.push("/gd/setup")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create New GD</span>
          </button>
        </div>
      </div>

      {/* GD Sessions History Table */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Your Group Discussions</h2>
              <p className="text-xs text-slate-400">
                Track active sessions, rejoin ongoing rooms, or inspect your individualized evaluation scorecards.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            <p className="text-xs">Loading GD sessions...</p>
          </div>
        ) : sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((s) => {
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
                      <span className="text-xs font-semibold text-slate-300">
                        {s.topic_category}
                      </span>
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

                    <p className="text-sm font-semibold text-white leading-relaxed">
                      {s.topic}
                    </p>

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
          <div className="text-center py-10 px-4 border border-dashed border-white/10 rounded-xl bg-slate-900/30">
            <Users className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No Group Discussions Yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create your first AI-moderated GD room above and invite peers to practice collaborative reasoning.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
