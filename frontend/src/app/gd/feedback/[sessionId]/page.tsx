"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import GDScorecardReport from "@/components/gd/GDScorecardReport";
import { authService } from "@/lib/auth";
import { gdService } from "@/lib/gd";
import { GDSession, GDEvaluation } from "@/types";
import {
  Users,
  Sparkles,
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  Share2,
  Check,
} from "lucide-react";

export default function GDFeedbackPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.sessionId as string;

  const [session, setSession] = useState<GDSession | null>(null);
  const [evaluation, setEvaluation] = useState<GDEvaluation | null>(null);
  const [participantName, setParticipantName] = useState<string>("Candidate");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!sessionId) return;

      // Check current user name
      if (authService.isAuthenticated()) {
        try {
          const user = await authService.getCurrentUser();
          if (user?.profile?.full_name) {
            setParticipantName(user.profile.full_name);
          } else if (user?.email) {
            setParticipantName(user.email.split("@")[0]);
          }
        } catch {}
      } else {
        // Read participant name from sessionStorage if guest
        let currentParticipantId: string | undefined;
        if (typeof window !== "undefined") {
          const stored = sessionStorage.getItem("prepx_gd_participant");
          if (stored) {
            try {
              const part = JSON.parse(stored);
              if (part?.display_name) {
                setParticipantName(part.display_name);
              }
              if (part?.id) {
                currentParticipantId = part.id;
              }
            } catch {}
          }
        }
      }

      // Check URL query parameters for participant_id as secondary fallback
      let resolvedParticipantId: string | undefined;
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        resolvedParticipantId = urlParams.get("participant_id") || undefined;
        if (!resolvedParticipantId) {
          const stored = sessionStorage.getItem("prepx_gd_participant");
          if (stored) {
            try {
              resolvedParticipantId = JSON.parse(stored)?.id;
            } catch {}
          }
        }
      }

      // 1. Fetch Session
      try {
        const sess = await gdService.getSession(sessionId, resolvedParticipantId);
        setSession(sess);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load session details.";
        setErrorMsg(msg);
        setIsLoading(false);
        return;
      }

      // 2. Fetch My Evaluation
      try {
        const evalData = await gdService.getMyEvaluation(sessionId, resolvedParticipantId);
        setEvaluation(evalData);
      } catch (err: unknown) {
        // Evaluation may not have been triggered yet
        console.log("[Notice]: Evaluation not yet generated, ready to synthesize on demand.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [sessionId]);

  const handleGenerateEvaluation = async () => {
    if (!sessionId) return;
    setIsGenerating(true);
    setErrorMsg(null);
    let resolvedParticipantId: string | undefined;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      resolvedParticipantId = urlParams.get("participant_id") || undefined;
      if (!resolvedParticipantId) {
        const stored = sessionStorage.getItem("prepx_gd_participant");
        if (stored) {
          try {
            resolvedParticipantId = JSON.parse(stored)?.id;
          } catch {}
        }
      }
    }

    try {
      await gdService.evaluateAllParticipants(sessionId);
      const evalData = await gdService.getMyEvaluation(sessionId, resolvedParticipantId);
      setEvaluation(evalData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate evaluation.";
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading your Group Discussion evaluation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace Dashboard</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? "Link Copied" : "Share Scorecard"}</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/gd/setup")}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold transition flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>New GD Session</span>
            </button>
          </div>
        </div>

        {/* State A: Evaluation Not Generated Yet */}
        {!evaluation && session && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Synthesize Individual Scorecard</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Sarah Jenkins will evaluate your attributable utterances against the 12-point rubric for "{session.topic}".
              </p>
            </div>

            {errorMsg && (
              <div className="flex items-center justify-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-lg text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateEvaluation}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Attributable Transcript...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Generate My Individual Evaluation
                </>
              )}
            </button>
          </div>
        )}

        {/* State B: Evaluation Ready */}
        {evaluation && session && (
          <GDScorecardReport
            evaluation={evaluation}
            session={session}
            participantName={participantName}
          />
        )}
      </main>
    </div>
  );
}
