"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/auth";
import { Sparkles, User, LogOut, LayoutDashboard, BrainCircuit, Bot } from "lucide-react";

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsLoggedIn(authService.isAuthenticated());
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    setIsLoggedIn(false);
    router.push("/");
  };

  return (
    <nav className="border-b border-white/10 bg-[#0a0d14]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold tracking-tight text-white">Prep<span className="text-indigo-400">X</span></span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              AI Arena
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-indigo-400" />
                Mode Select
              </Link>
              <Link
                href="/interview/setup"
                className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Sparkles className="h-4 w-4 text-indigo-400" />
                Personal Interview
              </Link>
              <Link
                href="/gd/setup"
                className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Bot className="h-4 w-4 text-emerald-400" />
                GD Arena
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg shadow-md shadow-indigo-600/30 transition-all hover:shadow-indigo-600/50 hover:scale-[1.02]"
              >
                <Sparkles className="h-4 w-4" />
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
