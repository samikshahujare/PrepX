"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { authService } from "@/lib/auth";
import { interviewService } from "@/lib/interview";
import { Resume, JDAnalysisResult, InterviewSession, Question } from "@/types";
import {
  BrainCircuit,
  FileText,
  Upload,
  Sparkles,
  Bot,
  Building,
  Target,
  Briefcase,
  Clock,
  Repeat,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Trash2,
  FileCode,
  Tag,
  GraduationCap,
  Layers,
  ChevronRight,
  Check,
} from "lucide-react";

const DOMAIN_OPTIONS = [
  "Software Engineering (Full Stack)",
  "Backend Engineering (Python/Java/Go)",
  "Frontend Engineering (React/Next.js)",
  "Data Science",
  "Machine Learning / AI",
  "Data Analytics",
  "Cloud & DevOps Architecture",
  "Cybersecurity Engineering",
  "Mobile App Development",
  "System Design & Distributed Systems",
];

const DURATION_OPTIONS = [15, 30, 45, 60];
const ATTEMPT_OPTIONS = [1, 2, 3];

export default function InterviewSetupPage() {
  const router = useRouter();

  // Authentication & Initial State
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [existingResumes, setExistingResumes] = useState<Resume[]>([]);

  // Step 1: Resume State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Job Description State
  const [jdTab, setJdTab] = useState<"text" | "file">("text");
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [isAnalyzingJD, setIsAnalyzingJD] = useState(false);
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysisResult | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);
  const jdFileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Target Configuration & Settings
  const [company, setCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [domain, setDomain] = useState("Software Engineering (Full Stack)");
  const [interviewMode, setInterviewMode] = useState<"Company-Specific" | "Role-Specific">("Role-Specific");
  const [difficulty, setDifficulty] = useState<"Low" | "Medium" | "High">("Medium");
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [allowedAttempts, setAllowedAttempts] = useState<number>(1);

  // Step 4: Generation & Ready State
  const [generationStep, setGenerationStep] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<InterviewSession | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);

  // 1. Verify Authentication & Load Prior Resumes
  useEffect(() => {
    async function init() {
      if (!authService.isAuthenticated()) {
        router.push("/login");
        return;
      }
      try {
        const resumes = await interviewService.listResumes();
        setExistingResumes(resumes);
        if (resumes.length > 0) {
          setSelectedResume(resumes[0]);
        }
      } catch (err) {
        console.error("Failed to load user resumes", err);
      } finally {
        setLoadingInitial(false);
      }
    }
    init();
  }, [router]);

  // Handle Resume Upload & Extraction
  const handleResumeFileSelect = async (file: File) => {
    setResumeFile(file);
    setResumeError(null);
    setIsUploadingResume(true);
    try {
      const parsedResume = await interviewService.uploadResume(file);
      setSelectedResume(parsedResume);
      setExistingResumes((prev) => [parsedResume, ...prev.filter((r) => r.id !== parsedResume.id)]);
    } catch (err: any) {
      setResumeError(
        err.response?.data?.message || "Failed to process resume. Please ensure it is a valid PDF or DOCX under 10MB."
      );
      setResumeFile(null);
    } finally {
      setIsUploadingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };

  const handleClearResume = () => {
    setResumeFile(null);
    setSelectedResume(null);
    setResumeError(null);
  };

  // Handle JD Analysis
  const handleAnalyzeJD = async () => {
    setJdError(null);
    setIsAnalyzingJD(true);
    try {
      let analysis: JDAnalysisResult;
      if (jdTab === "file" && jdFile) {
        analysis = await interviewService.parseJDFile(jdFile);
      } else {
        if (!jdText.trim() || jdText.trim().length < 15) {
          setJdError("Please enter or paste at least 15 characters of the job description.");
          setIsAnalyzingJD(false);
          return;
        }
        analysis = await interviewService.parseJDText(jdText.trim());
      }

      setJdAnalysis(analysis);

      // Pre-fill fields if not already populated or if default
      if (analysis.company && !company) {
        setCompany(analysis.company);
        setInterviewMode("Company-Specific");
      }
      if (analysis.target_role && !targetRole) {
        setTargetRole(analysis.target_role);
      }
      if (analysis.domain) {
        setDomain(analysis.domain);
      }
    } catch (err: any) {
      setJdError(
        err.response?.data?.message || "Failed to analyze Job Description. Please verify the content and format."
      );
    } finally {
      setIsAnalyzingJD(false);
    }
  };

  const handleClearJD = () => {
    setJdFile(null);
    setJdText("");
    setJdAnalysis(null);
    setJdError(null);
    if (jdFileInputRef.current) jdFileInputRef.current.value = "";
  };

  // Validation: Ready to Generate? (Resume is required, JD is optional)
  const canGenerate = Boolean(
    selectedResume &&
    domain &&
    !isGenerating
  );

  // Generate Personalized Interview Session & Questions
  const handleGenerateInterview = async () => {
    setErrorMsg(null);
    setIsGenerating(true);

    try {
      // Phase A: JD analysis if text/file was provided (optional)
      let currentJdAnalysis = jdAnalysis;
      if (!currentJdAnalysis && jdText.trim().length >= 15) {
        setGenerationStep("Analyzing job description...");
        currentJdAnalysis = await interviewService.parseJDText(jdText.trim());
        setJdAnalysis(currentJdAnalysis);
      }

      // Phase B: Create interview session record
      setGenerationStep("Creating personalized interview session...");
      const session = await interviewService.createInterviewSession({
        domain,
        company: company.trim() || undefined,
        target_role: targetRole.trim() || undefined,
        interview_mode: interviewMode,
        difficulty,
        duration_minutes: durationMinutes,
        allowed_attempts: allowedAttempts,
        resume_id: selectedResume?.id,
        job_description: currentJdAnalysis?.raw_text || jdText.trim() || undefined,
        jd_analysis: currentJdAnalysis || undefined,
      });

      setCreatedSession(session);

      // Phase C: Generate tailored questions scaled to the configured interview duration
      setGenerationStep("Generating tailored interview questions with Sarah Jenkins...");
      const targetCount = durationMinutes <= 15 ? 10 : durationMinutes <= 30 ? 16 : durationMinutes <= 45 ? 22 : 28;
      const questions = await interviewService.generateQuestions(session.id, targetCount);
      setGeneratedQuestions(questions);

      setGenerationStep("Interview ready.");
    } catch (err: any) {
      console.error("Interview generation failed", err);
      setErrorMsg(
        err.response?.data?.message || "Failed to create personalized interview session. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Start Live Interview Navigation
  const handleStartInterview = () => {
    if (createdSession?.id) {
      router.push(`/interview/${createdSession.id}`);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center text-white">
        <Loader2 className="h-9 w-9 text-indigo-500 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-400">Loading PrepX Interview Preparation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0d14] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col gap-8">
        {/* Header */}
        <div className="border-b border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <BrainCircuit className="h-4 w-4" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Prepare Your Interview
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Upload your resume and job description to create a personalized AI interview with Sarah Jenkins.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl glass-panel text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Candidate Workspace
          </button>
        </div>

        {/* Global Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-sm text-red-300">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Preparation Error</p>
              <p className="text-xs text-red-300/90 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Interactive Steps Grid */}
        <div className="grid grid-cols-1 gap-8">
          {/* STEP 1: RESUME UPLOAD & PARSING */}
          <section className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 relative">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                  1
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  Candidate Resume
                </h2>
              </div>

              {selectedResume && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resume Analyzed
                  </span>
                  <button
                    onClick={handleClearResume}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove or replace resume"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {resumeError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{resumeError}</span>
              </div>
            )}

            {!selectedResume ? (
              <div className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onClick={() => resumeInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-white/[0.02] flex flex-col items-center justify-center gap-3"
                >
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleResumeFileSelect(file);
                    }}
                  />
                  {isUploadingResume ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                      <p className="text-sm font-semibold text-white">Analyzing Resume...</p>
                      <p className="text-xs text-slate-400">Extracting skills, projects, and career history</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Click or drag & drop to upload your resume</p>
                        <p className="text-xs text-slate-400 mt-1">Supports PDF and DOCX documents (Up to 10MB)</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Existing resumes list if available */}
                {existingResumes.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Or select previously uploaded resume:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {existingResumes.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedResume(r)}
                          className="p-3 rounded-xl bg-slate-900/60 border border-white/10 hover:border-indigo-500/40 text-left transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <FileCode className="h-4 w-4 text-indigo-400 shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-white truncate">{r.original_filename}</p>
                              <p className="text-[10px] text-slate-400">{r.profile?.skills?.length || 0} skills detected</p>
                            </div>
                          </div>
                          <span className="text-xs text-indigo-400 font-semibold shrink-0 ml-2">Select</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Analyzed Resume Compact Card */
              <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-5 w-5 text-indigo-400" />
                    <div>
                      <p className="text-sm font-bold text-white">{selectedResume.original_filename}</p>
                      <p className="text-xs text-slate-400">
                        {selectedResume.profile?.candidate_name || "Candidate"} • {(selectedResume.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => resumeInputRef.current?.click()}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    Change Resume
                  </button>
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleResumeFileSelect(file);
                    }}
                  />
                </div>

                {/* Parsed Skills Badges */}
                {selectedResume.profile?.skills && selectedResume.profile.skills.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Tag className="h-3 w-3 text-indigo-400" />
                      Extracted Candidate Skills ({selectedResume.profile.skills.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedResume.profile.skills.slice(0, 14).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                      {selectedResume.profile.skills.length > 14 && (
                        <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-400 text-xs">
                          +{selectedResume.profile.skills.length - 14} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* STEP 2: JOB DESCRIPTION UPLOAD OR PASTE */}
          <section className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 relative">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                  2
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-400" />
                  Target Job Description (JD)
                  <span className="text-[11px] font-normal text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full ml-1">
                    Optional
                  </span>
                </h2>
              </div>

              {jdAnalysis && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    JD Analyzed
                  </span>
                  <button
                    onClick={handleClearJD}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove or replace job description"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {jdError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{jdError}</span>
              </div>
            )}

            {!jdAnalysis ? (
              <div className="space-y-4">
                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <button
                    onClick={() => setJdTab("text")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      jdTab === "text"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "glass-panel text-slate-400 hover:text-white"
                    }`}
                  >
                    Paste JD Text
                  </button>
                  <button
                    onClick={() => setJdTab("file")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      jdTab === "file"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "glass-panel text-slate-400 hover:text-white"
                    }`}
                  >
                    Upload JD Document
                  </button>
                </div>

                {jdTab === "text" ? (
                  <div>
                    <textarea
                      rows={5}
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the full job description here (responsibilities, requirements, tech stack, company details)..."
                      className="w-full p-4 rounded-xl bg-slate-900/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-500">{jdText.length} characters</span>
                      <button
                        onClick={handleAnalyzeJD}
                        disabled={isAnalyzingJD || jdText.trim().length < 15}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all"
                      >
                        {isAnalyzingJD ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Analyzing JD...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Analyze Job Description</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      onClick={() => jdFileInputRef.current?.click()}
                      className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-white/[0.02] flex flex-col items-center justify-center gap-3"
                    >
                      <input
                        ref={jdFileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setJdFile(file);
                          }
                        }}
                      />
                      <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {jdFile ? jdFile.name : "Click or drag & drop Job Description document"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, or TXT files</p>
                      </div>
                    </div>

                    {jdFile && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={handleAnalyzeJD}
                          disabled={isAnalyzingJD}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2"
                        >
                          {isAnalyzingJD ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Extracting & Analyzing JD...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Analyze Uploaded JD</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Analyzed JD Compact Card */
              <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Detected Role</span>
                    <p className="text-sm font-bold text-white">{jdAnalysis.target_role || "Role from JD"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Detected Company</span>
                    <p className="text-sm font-bold text-cyan-400">{jdAnalysis.company || "General Tech Company"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Inferred Domain</span>
                    <p className="text-sm font-bold text-indigo-400">{jdAnalysis.domain}</p>
                  </div>
                </div>

                {/* Skills Detected in JD */}
                {jdAnalysis.required_skills && jdAnalysis.required_skills.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Required Technical Competencies ({jdAnalysis.required_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {jdAnalysis.required_skills.slice(0, 12).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* STEP 3: INTERVIEW CONFIGURATION & TARGET SETTINGS */}
          <section className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 relative">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                3
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-400" />
                Interview Configuration & Targeting
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Target Company */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-cyan-400" />
                  Target Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Goldman Sachs, Google, Microsoft"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Prefilled from JD if detected. Editable by candidate.
                </span>
              </div>

              {/* Target Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
                  Target Role
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Software Engineer, Data Analyst, Machine Learning Engineer"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Specific engineering role targeted for this simulation.
                </span>
              </div>

              {/* Domain */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-400" />
                  Engineering Domain
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  {DOMAIN_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Interview Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Interview Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInterviewMode("Role-Specific")}
                    className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex flex-col gap-0.5 ${
                      interviewMode === "Role-Specific"
                        ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="font-bold">Role-Specific</span>
                    <span className="text-[10px] opacity-80">Core technical depth & responsibilities</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterviewMode("Company-Specific")}
                    className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex flex-col gap-0.5 ${
                      interviewMode === "Company-Specific"
                        ? "bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/20"
                        : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="font-bold">Company-Specific</span>
                    <span className="text-[10px] opacity-80">Company scale, culture & architecture</span>
                  </button>
                </div>
              </div>

              {/* Difficulty Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Interview Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Low", "Medium", "High"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        difficulty === lvl
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                          : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration & Attempts */}
              <div className="grid grid-cols-2 gap-3">
                {/* Duration */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    Duration
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DURATION_OPTIONS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          durationMinutes === mins
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Attempts */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-indigo-400" />
                    Allowed Attempts
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ATTEMPT_OPTIONS.map((att) => (
                      <button
                        key={att}
                        type="button"
                        onClick={() => setAllowedAttempts(att)}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          allowedAttempts === att
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {att} {att === 1 ? "try" : "tries"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 4: GENERATE INTERVIEW & READY CARD */}
          {!createdSession ? (
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  Ready to Generate Personalized Interview?
                </h3>
                <p className="text-xs text-slate-400">
                  PrepX AI will synthesize your resume projects with the job description to generate 5 tailored questions.
                </p>
              </div>

              <button
                onClick={handleGenerateInterview}
                disabled={!canGenerate || isGenerating}
                className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{generationStep || "Generating Interview..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-indigo-200" />
                    <span>Generate My Interview</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* SESSION READY SUMMARY & DIRECT START INTERVIEW BUTTON */
            <section className="glass-panel p-6 sm:p-8 rounded-2xl border-2 border-emerald-500/40 shadow-2xl relative bg-gradient-to-b from-emerald-950/20 to-slate-950/80">
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-5 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white">Your Personalized Interview Is Ready</h2>
                    <p className="text-xs text-slate-400">Sarah Jenkins is waiting in the AI Interview Room</p>
                  </div>
                </div>

                <button
                  onClick={handleStartInterview}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.03]"
                >
                  <Bot className="h-5 w-5" />
                  <span>START INTERVIEW</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* Session Meta Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Company</span>
                  <span className="text-xs font-bold text-white truncate block">{createdSession.company || "General"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Role</span>
                  <span className="text-xs font-bold text-white truncate block">{createdSession.target_role || domain}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Mode</span>
                  <span className="text-xs font-bold text-purple-400 block">{createdSession.interview_mode || interviewMode}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Difficulty</span>
                  <span className="text-xs font-bold text-indigo-400 block">{createdSession.difficulty}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Duration</span>
                  <span className="text-xs font-bold text-emerald-400 block">{createdSession.duration_minutes || durationMinutes} min</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Attempts</span>
                  <span className="text-xs font-bold text-white block">{createdSession.allowed_attempts || allowedAttempts} max</span>
                </div>
              </div>

              {/* Questions Preview */}
              {generatedQuestions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    Personalized Questions Generated ({generatedQuestions.length})
                  </h4>
                  <div className="space-y-2.5">
                    {generatedQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-start gap-3"
                      >
                        <span className="h-6 w-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-mono font-bold text-xs shrink-0 mt-0.5">
                          {q.sequence_number}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              {q.category}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {q.difficulty}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                            {q.question_text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
