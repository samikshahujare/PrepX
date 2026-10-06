"use client";

import React, { useEffect, useState, useRef } from "react";
import { InterviewState } from "@/types";
import { Bot, Sparkles, Volume2, Mic, BrainCircuit, ShieldCheck, Waves, Activity, Eye, Zap } from "lucide-react";

interface FemaleAvatarProps {
  state: InterviewState;
  interviewerText?: string;
  isSpeaking: boolean;
  audioLevel?: number; // 0 to 100 for candidate listening reaction
}

export default function FemaleAvatar({
  state,
  interviewerText,
  isSpeaking,
  audioLevel = 0,
}: FemaleAvatarProps) {
  // Lip-sync / mouth opening oscillation state
  const [mouthOpen, setMouthOpen] = useState(0); // 0 (closed) to 1 (wide)
  const [mouthShape, setMouthShape] = useState<"round" | "wide" | "open">("open");
  const [blink, setBlink] = useState(false);
  const [eyeGaze, setEyeGaze] = useState({ x: 0, y: 0 });
  const [headRotation, setHeadRotation] = useState({ x: 0, y: 0, z: 0 });
  const [waveHeights, setWaveHeights] = useState<number[]>([14, 22, 32, 26, 18, 28, 36, 20, 24, 30]);
  const [hudAngle, setHudAngle] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Mouse / Gaze 3D tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) / (rect.width / 2);
      const deltaY = (e.clientY - centerY) / (rect.height / 2);

      // Clamp movement for realistic head tracking
      const clampedX = Math.max(Math.min(deltaX * 6, 8), -8);
      const clampedY = Math.max(Math.min(deltaY * 4, 6), -6);
      setEyeGaze({ x: clampedX * 0.6, y: clampedY * 0.5 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Periodic natural blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3800 + Math.random() * 2400);

    return () => clearInterval(blinkInterval);
  }, []);

  // Natural organic 3D head movement and posture transitions
  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      tick += 1;
      if (state === "speaking") {
        setHeadRotation({
          x: Math.sin(tick * 0.8) * 3,
          y: Math.cos(tick * 0.6) * 4,
          z: Math.sin(tick * 0.4) * 1.5,
        });
      } else if (state === "listening") {
        // Attentive lean toward candidate
        setHeadRotation({
          x: -2 + Math.sin(tick * 0.3) * 0.8,
          y: 2.5 + Math.cos(tick * 0.3) * 0.8,
          z: 1,
        });
      } else if (state === "processing") {
        // Analytical upward-right gaze
        setHeadRotation({
          x: 2.5 + Math.sin(tick * 0.5) * 1,
          y: -3 + Math.cos(tick * 0.5) * 1,
          z: -1.5,
        });
      } else {
        // Subtle ambient breathing
        setHeadRotation({
          x: Math.sin(tick * 0.4) * 1.2,
          y: Math.cos(tick * 0.3) * 1.5,
          z: 0,
        });
      }
    }, 200);

    return () => clearInterval(interval);
  }, [state]);

  // Speaking mouth viseme simulation and dynamic waveform
  useEffect(() => {
    let step = 0;
    const animateMouth = () => {
      step += 0.28;
      setHudAngle((prev) => (prev + 0.6) % 360);

      if (isSpeaking) {
        // Syllabic viseme interpolation
        const m = Math.abs(Math.sin(step) * 0.7 + Math.sin(step * 2.1) * 0.3);
        setMouthOpen(Math.min(Math.max(m, 0.08), 1));

        // Switch mouth viseme contours periodically
        const shapeMod = Math.floor(step % 3);
        if (shapeMod === 0) setMouthShape("open");
        else if (shapeMod === 1) setMouthShape("round");
        else setMouthShape("wide");

        // Dynamic multi-band audio spectrum
        setWaveHeights((prev) =>
          prev.map((_, i) => 8 + Math.floor(Math.abs(Math.sin(step + i * 0.6)) * 30))
        );
      } else {
        setMouthOpen(0);
        setWaveHeights([8, 10, 8, 14, 10, 8, 12, 10, 8, 12]);
      }

      animationFrameRef.current = requestAnimationFrame(animateMouth);
    };

    animationFrameRef.current = requestAnimationFrame(animateMouth);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpeaking]);

  // 3D Orbiting Canvas Particles Simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: { x: number; y: number; size: number; speed: number; angle: number; radius: number; color: string }[] = [];
    const numParticles = 40;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: 0,
        y: 0,
        size: Math.random() * 2 + 1,
        speed: (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1),
        angle: Math.random() * Math.PI * 2,
        radius: 120 + Math.random() * 50,
        color: i % 2 === 0 ? "rgba(99, 102, 241, " : "rgba(34, 211, 238, ",
      });
    }

    let pAnimId: number;
    const renderParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      particles.forEach((p) => {
        p.angle += p.speed;
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * (p.radius * 0.45); // 3D elliptical tilt

        const alpha = Math.sin(p.angle) * 0.4 + 0.6; // depth attenuation
        ctx.beginPath();
        ctx.arc(x, y, p.size * (0.8 + alpha * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = p.color + alpha + ")";
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color + "0.8)";
        ctx.fill();
      });

      pAnimId = requestAnimationFrame(renderParticles);
    };

    renderParticles();
    return () => cancelAnimationFrame(pAnimId);
  }, []);

  // Dynamic theme colors per state
  const getStateConfig = () => {
    switch (state) {
      case "speaking":
        return {
          glow: "from-indigo-600/35 via-purple-600/25 to-transparent",
          border: "border-indigo-500/60 shadow-[0_0_50px_rgba(99,102,241,0.35)]",
          tagBg: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
          statusText: "Speaking...",
          badgeColor: "text-indigo-400",
          icon: <Volume2 className="h-3.5 w-3.5 animate-pulse text-indigo-400" />,
        };
      case "listening":
        return {
          glow: "from-cyan-500/35 via-blue-600/25 to-transparent",
          border: "border-cyan-400/60 shadow-[0_0_50px_rgba(34,211,238,0.35)]",
          tagBg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
          statusText: "Listening to candidate...",
          badgeColor: "text-cyan-400",
          icon: <Mic className="h-3.5 w-3.5 animate-pulse text-cyan-400" />,
        };
      case "processing":
        return {
          glow: "from-amber-500/35 via-orange-600/25 to-transparent",
          border: "border-amber-400/60 shadow-[0_0_50px_rgba(251,191,36,0.35)]",
          tagBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          statusText: "Evaluating response & reasoning...",
          badgeColor: "text-amber-400",
          icon: <BrainCircuit className="h-3.5 w-3.5 animate-spin text-amber-400" />,
        };
      case "paused":
        return {
          glow: "from-slate-700/20 to-transparent",
          border: "border-slate-600/40",
          tagBg: "bg-slate-800 text-slate-400 border-slate-700",
          statusText: "Interview Paused",
          badgeColor: "text-slate-400",
          icon: <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />,
        };
      case "completed":
        return {
          glow: "from-emerald-500/35 via-teal-600/25 to-transparent",
          border: "border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.35)]",
          tagBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          statusText: "Interview Completed",
          badgeColor: "text-emerald-400",
          icon: <Sparkles className="h-3.5 w-3.5 text-emerald-400" />,
        };
      default:
        return {
          glow: "from-indigo-600/20 to-transparent",
          border: "border-white/10",
          tagBg: "bg-white/10 text-slate-300 border-white/10",
          statusText: "Ready to start",
          badgeColor: "text-indigo-400",
          icon: <Bot className="h-3.5 w-3.5 text-indigo-400" />,
        };
    }
  };

  const stateConfig = getStateConfig();

  // Dynamic mouth dimensions
  const mouthHeight = 2 + mouthOpen * (mouthShape === "round" ? 18 : 14);
  const mouthWidth = 26 + mouthOpen * (mouthShape === "wide" ? 14 : 6);
  const mouthY = 192 - mouthOpen * 2.5;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[440px] rounded-3xl overflow-hidden glass-panel border flex flex-col justify-between p-6 transition-all duration-500 bg-slate-950/85 shadow-2xl select-none"
    >
      {/* 3D Dynamic Ambient Studio Aura */}
      <div
        className={`absolute inset-0 bg-gradient-radial ${stateConfig.glow} opacity-70 pointer-events-none transition-all duration-700`}
      />

      {/* Futuristic Background Matrix */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* Top Header Information HUD */}
      <div className="relative z-20 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-lg shadow-indigo-500/20 backdrop-blur-md">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white tracking-tight">Sarah</h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30">
                PrepX 3D AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Senior AI Interviewer • Real-time
            </p>
          </div>
        </div>

        {/* State Badge Pill */}
        <div
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border shadow-xl backdrop-blur-md transition-all duration-300 ${stateConfig.tagBg}`}
        >
          {stateConfig.icon}
          <span>{stateConfig.statusText}</span>
        </div>
      </div>

      {/* 3D Holographic Canvas & Persona Arena */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-3 perspective-[1000px]">
        {/* Background Orbiting Particle Canvas */}
        <canvas
          ref={canvasRef}
          width={380}
          height={380}
          className="absolute inset-0 m-auto pointer-events-none z-0 opacity-80"
        />

        {/* Holographic 3D Orbit Ring */}
        <div
          className="absolute w-72 h-72 rounded-full border border-dashed border-indigo-500/20 pointer-events-none z-0"
          style={{
            transform: `rotateX(68deg) rotateZ(${hudAngle}deg)`,
            boxShadow: "0 0 30px rgba(99, 102, 241, 0.15)",
          }}
        />

        {/* Dynamic AI Head & Face Container with 3D Perspective Rotation */}
        <div
          className={`relative p-2 rounded-full transition-transform duration-200 z-10 ${stateConfig.border}`}
          style={{
            transform: `perspective(800px) rotateY(${headRotation.y}deg) rotateX(${-headRotation.x}deg) rotateZ(${headRotation.z}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Main Visual Persona Portrait */}
          <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-indigo-950 border border-white/20 relative shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]">
            <svg
              viewBox="0 0 260 260"
              className="w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* 3D Volumetric Skin Shading with Subsurface Scattering Simulation */}
                <radialGradient id="skin3D" cx="42%" cy="38%" r="62%">
                  <stop offset="0%" stopColor="#fae0cc" />
                  <stop offset="45%" stopColor="#f4cbaf" />
                  <stop offset="85%" stopColor="#e2af8d" />
                  <stop offset="100%" stopColor="#cb916d" />
                </radialGradient>

                {/* Soft Cyber Cyan Rim Light for Depth */}
                <linearGradient id="rimLight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="transparent" stopOpacity="0" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0.4" />
                </linearGradient>

                {/* Hair Gradient with Natural Sheen Layer */}
                <linearGradient id="hairRealGrad" x1="0%" y1="0%" x2="30%" y2="100%">
                  <stop offset="0%" stopColor="#3b2219" />
                  <stop offset="35%" stopColor="#24140e" />
                  <stop offset="70%" stopColor="#140b08" />
                  <stop offset="100%" stopColor="#080403" />
                </linearGradient>

                {/* Iris Depth Gradient */}
                <radialGradient id="iris3D" cx="38%" cy="38%" r="60%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#3730a3" />
                  <stop offset="85%" stopColor="#1e1b4b" />
                  <stop offset="100%" stopColor="#09090b" />
                </radialGradient>

                {/* Professional Blazer Texture */}
                <linearGradient id="blazer3D" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="50%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#020617" />
                </linearGradient>

                {/* Blouse Silk Gradient */}
                <linearGradient id="blouseSilk" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="60%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#3730a3" />
                </linearGradient>
              </defs>

              {/* Background Hair Volume Layer */}
              <path
                d="M 55 130 C 45 75, 75 20, 130 20 C 185 20, 215 75, 205 130 C 210 185, 200 235, 200 260 L 60 260 C 60 235, 50 185, 55 130 Z"
                fill="url(#hairRealGrad)"
              />

              {/* Neck & Shading */}
              <path
                d="M 110 178 L 110 228 C 110 234, 150 234, 150 228 L 150 178 Z"
                fill="url(#skin3D)"
              />
              <path
                d="M 110 178 Q 130 198 150 178 L 150 190 Q 130 210 110 190 Z"
                fill="#b87b54"
                opacity="0.6"
              />

              {/* Tailored Professional Blazer & Silk Inner */}
              <path
                d="M 35 260 C 40 218, 80 208, 108 212 L 130 248 L 152 212 C 180 208, 220 218, 225 260 Z"
                fill="url(#blazer3D)"
                stroke="#334155"
                strokeWidth="1.2"
              />
              {/* Inner Silk Top */}
              <path
                d="M 110 212 L 130 250 L 150 212 Q 130 218 110 212 Z"
                fill="url(#blouseSilk)"
              />
              {/* Left & Right Lapels */}
              <path
                d="M 72 218 L 114 258 L 126 218 Z"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="0.8"
              />
              <path
                d="M 188 218 L 146 258 L 134 218 Z"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="0.8"
              />

              {/* Head & Face Contour */}
              <path
                d="M 76 114 C 73 162, 94 206, 130 206 C 166 206, 187 162, 184 114 C 182 66, 162 48, 130 48 C 98 48, 78 66, 76 114 Z"
                fill="url(#skin3D)"
                stroke="#d39972"
                strokeWidth="0.6"
              />

              {/* Cyber Rim Light Glow on Cheek Contour */}
              <path
                d="M 76 114 C 73 162, 94 206, 130 206 C 166 206, 187 162, 184 114 C 182 66, 162 48, 130 48 C 98 48, 78 66, 76 114 Z"
                fill="url(#rimLight)"
                style={{ mixBlendMode: "screen" }}
              />

              {/* Natural High-Definition Cheek Blush */}
              <ellipse cx="96" cy="148" rx="16" ry="8" fill="#f43f5e" opacity="0.18" />
              <ellipse cx="164" cy="148" rx="16" ry="8" fill="#f43f5e" opacity="0.18" />

              {/* Dynamic Expressive Eyebrows */}
              <path
                d={
                  state === "listening"
                    ? "M 86 107 Q 102 100 116 105"
                    : state === "processing"
                    ? "M 86 104 Q 102 107 116 108"
                    : "M 86 106 Q 102 102 116 107"
                }
                fill="none"
                stroke="#24140e"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <path
                d={
                  state === "listening"
                    ? "M 144 105 Q 158 100 174 107"
                    : state === "processing"
                    ? "M 144 108 Q 158 107 174 104"
                    : "M 144 107 Q 158 102 174 106"
                }
                fill="none"
                stroke="#24140e"
                strokeWidth="2.8"
                strokeLinecap="round"
              />

              {/* High-Definition Eyes with Interactive Gaze & Blink */}
              {blink ? (
                // Natural Eyelid Closure
                <>
                  <path
                    d="M 88 126 Q 102 133 116 126"
                    fill="none"
                    stroke="#1c120c"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 144 126 Q 158 133 172 126"
                    fill="none"
                    stroke="#1c120c"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                // Open Eyes with Cornea Reflections & Gaze Offset
                <>
                  {/* Left Eye */}
                  <g transform={`translate(${eyeGaze.x}, ${eyeGaze.y})`}>
                    <path
                      d="M 86 124 Q 102 113 118 124 Q 102 135 86 124 Z"
                      fill="#ffffff"
                    />
                    <circle cx="102" cy="124" r="5.6" fill="url(#iris3D)" />
                    <circle cx="102" cy="124" r="2.8" fill="#050508" />
                    {/* Primary specular highlight */}
                    <circle cx="100.2" cy="122.2" r="1.5" fill="#ffffff" />
                    {/* Secondary subtle catchlight */}
                    <circle cx="103.8" cy="125.8" r="0.8" fill="#a5b4fc" opacity="0.8" />
                    {/* Upper Eyelash line */}
                    <path
                      d="M 85 123 Q 102 112 119 123"
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </g>

                  {/* Right Eye */}
                  <g transform={`translate(${eyeGaze.x}, ${eyeGaze.y})`}>
                    <path
                      d="M 142 124 Q 158 113 174 124 Q 158 135 142 124 Z"
                      fill="#ffffff"
                    />
                    <circle cx="158" cy="124" r="5.6" fill="url(#iris3D)" />
                    <circle cx="158" cy="124" r="2.8" fill="#050508" />
                    {/* Primary specular highlight */}
                    <circle cx="156.2" cy="122.2" r="1.5" fill="#ffffff" />
                    {/* Secondary catchlight */}
                    <circle cx="159.8" cy="125.8" r="0.8" fill="#a5b4fc" opacity="0.8" />
                    {/* Upper Eyelash line */}
                    <path
                      d="M 141 123 Q 158 112 175 123"
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </g>
                </>
              )}

              {/* Realistic Nose Contour & Ambient Shadow */}
              <path
                d="M 128 132 L 125 158 Q 130 163 135 158"
                fill="none"
                stroke="#be7a51"
                strokeWidth="1.6"
                strokeLinecap="round"
              />

              {/* Dynamic High-Realism Viseme Mouth Sync */}
              <g>
                {mouthOpen > 0.08 ? (
                  <>
                    {/* Inner Oral Cavity */}
                    <ellipse
                      cx="130"
                      cy={mouthY}
                      rx={mouthWidth / 2}
                      ry={mouthHeight / 2}
                      fill="#631414"
                      stroke="#be185d"
                      strokeWidth="1.4"
                    />
                    {/* Upper Teeth Enamel */}
                    <rect
                      x={130 - mouthWidth / 3.2}
                      y={mouthY - mouthHeight / 2.3}
                      width={(mouthWidth * 2) / 3.2}
                      height={Math.min(mouthHeight * 0.4, 4.5)}
                      rx="1.2"
                      fill="#ffffff"
                      opacity="0.9"
                    />
                    {/* Tongue Highlight */}
                    <ellipse
                      cx="130"
                      cy={mouthY + mouthHeight * 0.22}
                      rx={mouthWidth / 3.6}
                      ry={mouthHeight * 0.24}
                      fill="#e11d48"
                      opacity="0.85"
                    />
                    {/* Upper Lip Definition */}
                    <path
                      d={`M ${130 - mouthWidth / 2} ${mouthY} Q ${130 - mouthWidth / 4} ${mouthY - 4} 130 ${mouthY - 2} Q ${130 + mouthWidth / 4} ${mouthY - 4} ${130 + mouthWidth / 2} ${mouthY}`}
                      fill="none"
                      stroke="#be185d"
                      strokeWidth="2"
                    />
                  </>
                ) : (
                  // Pleasant Confident Resting Smile
                  <>
                    <path
                      d="M 115 186 Q 130 194 145 186"
                      fill="none"
                      stroke="#9f1239"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 118 185 Q 130 188 142 185"
                      fill="none"
                      stroke="#fda4af"
                      strokeWidth="1"
                      opacity="0.6"
                    />
                  </>
                )}
              </g>

              {/* Multi-layered Front Hair Framing */}
              <path
                d="M 72 98 C 68 42, 108 28, 130 28 C 162 28, 188 42, 188 98 C 172 62, 146 54, 126 56 C 104 58, 82 72, 72 98 Z"
                fill="url(#hairRealGrad)"
              />
              <path
                d="M 72 88 Q 65 142 72 178 Q 80 142 80 102 Z"
                fill="url(#hairRealGrad)"
              />
              <path
                d="M 188 88 Q 195 142 188 178 Q 180 142 180 102 Z"
                fill="url(#hairRealGrad)"
              />

              {/* Minimalist AI Headset (Studio Grade) */}
              <g>
                <path
                  d="M 64 120 C 60 76, 92 42, 130 42 C 168 42, 200 76, 196 120"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.2"
                  opacity="0.85"
                />
                <circle cx="64" cy="124" r="7.5" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.8" />
                <circle cx="196" cy="124" r="7.5" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.8" />
                {/* Microphone Stem & Glowing LED */}
                <path
                  d="M 196 128 Q 188 168 156 178"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle
                  cx="156"
                  cy="178"
                  r="4"
                  fill={isSpeaking ? "#22d3ee" : state === "listening" ? "#38bdf8" : "#6366f1"}
                  className={isSpeaking ? "animate-pulse" : ""}
                />
              </g>
            </svg>
          </div>
        </div>

        {/* Dynamic Equalizer Audio Frequency Spectrum */}
        <div className="mt-4 flex items-center justify-center gap-1.5 h-9 px-5 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-lg">
          <Waves className={`h-4 w-4 mr-1 shrink-0 ${stateConfig.badgeColor}`} />
          {waveHeights.map((h, index) => (
            <span
              key={index}
              className={`w-1 rounded-full transition-all duration-150 ${
                isSpeaking
                  ? "bg-gradient-to-t from-indigo-500 via-purple-400 to-cyan-300"
                  : state === "listening"
                  ? "bg-gradient-to-t from-cyan-500 to-emerald-400"
                  : "bg-slate-700"
              }`}
              style={{
                height: `${
                  isSpeaking
                    ? h
                    : state === "listening"
                    ? 8 + (audioLevel / 8) * (1 + (index % 3) * 0.2)
                    : 6
                }px`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Real-time Subtitle / Latest Statement Card */}
      {interviewerText && (
        <div className="relative z-20 p-4 rounded-2xl bg-slate-900/90 border border-white/15 backdrop-blur-xl shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Sarah (AI Interviewer)</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
              <Activity className="h-3 w-3 text-cyan-400" />
              <span>{isSpeaking ? "Speaking" : "Active"}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
            "{interviewerText}"
          </p>
        </div>
      )}
    </div>
  );
}
