"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { authService } from "@/lib/auth";
import { interviewService } from "@/lib/interview";
import { User, Resume, InterviewSession, Question } from "@/types";
import {
  BrainCircuit,
  Bot,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  User as UserIcon,
  Save,
  Loader2,
  Upload,
  FileText,
  FileCode,
  Tag,
  GraduationCap,
  Building,
  Target,
  Gauge,
  HelpCircle,
  Layers,
  ArrowRight,
  Check,
  RefreshCw,
} from "lucide-react";

const DOMAIN_OPTIONS = [
  "Data Science",
  "Machine Learning / AI",
  "Data Analytics",
  "Software Engineering (Full Stack)",
  "Backend Engineering (Python/Java/Go)",
  "Frontend Engineering (React/Next.js)",
  "Cloud & DevOps Architecture",
  "Cybersecurity Engineering",
  "Mobile App Development",
  "System Design & Distributed Systems",
];

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [bio, setBio] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Phase 2 State
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState("Data Science");
  const [companyName, setCompanyName] = useState("");
  const [difficulty, setDifficulty] = useState<"Low" | "Medium" | "High">("Medium");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      if (!authService.isAuthenticated()) {
        router.push("/login");
        return;
      }
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
        setFullName(userData.profile?.full_name || "");
        setTargetDomain(userData.profile?.target_domain || "Data Science");
        setExperienceLevel(userData.profile?.experience_level || "Fresher / Entry Level");
        setBio(userData.profile?.bio || "");

        // Load existing resumes
        const resumeList = await interviewService.listResumes();
        setResumes(resumeList);
        if (resumeList.length > 0) {
          setSelectedResume(resumeList[0]);
        }

        // Load previous sessions
        const sessions = await interviewService.listInterviewSessions();
        if (sessions.length > 0) {
          const latestSession = sessions[0];
          setCurrentSession(latestSession);
          if (latestSession.questions && latestSession.questions.length > 0) {
            setQuestions(latestSession.questions);
          }
        }
      } catch (err) {
        authService.clearTokens();
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await authService.updateProfile({
        full_name: fullName,
        target_domain: targetDomain,
        experience_level: experienceLevel,
        bio: bio,
      });
      const updatedUser = await authService.getCurrentUser();
      setUser(updatedUser);
      setSaveSuccess(true);
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      const newResume = await interviewService.uploadResume(file);
      setResumes((prev) => [newResume, ...prev]);
      setSelectedResume(newResume);
    } catch (err: any) {
      setUploadError(
        err.response?.data?.message || "Failed to upload and parse resume. Please ensure it is a valid PDF or DOCX file under 10MB."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCreateSessionAndGenerate = async () => {
    setIsCreatingSession(true);
    setUploadError(null);

    try {
      const session = await interviewService.createInterviewSession({
        domain: selectedDomain,
        company: companyName.trim() || undefined,
        difficulty: difficulty,
        resume_id: selectedResume?.id,
      });
      setCurrentSession(session);

      setIsGeneratingQuestions(true);
      const generatedQuestions = await interviewService.generateQuestions(session.id, 5);
      setQuestions(generatedQuestions);
    } catch (err: any) {
      setUploadError(err.response?.data?.message || "Failed to create session or generate questions.");
    } finally {
      setIsCreatingSession(false);
      setIsGeneratingQuestions(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0d14]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Candidate Workspace
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Phase 2 Active (Resume Intelligence)
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Welcome back, <span className="text-white font-medium">{user?.profile?.full_name || user?.email}</span>. Prepare for your technical interviews with AI.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/interview/setup")}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Prepare New Interview
            </button>
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-4 py-2 rounded-xl text-xs font-semibold glass-panel text-slate-200 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <UserIcon className="h-3.5 w-3.5 text-indigo-400" />
              {isEditingProfile ? "Cancel Editing" : "Account Profile"}
            </button>
          </div>
        </div>

        {/* Quick Launch Interview Preparation Banner */}
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Targeted AI Mock Interview Preparation</h3>
              <p className="text-xs text-slate-400">
                Upload your resume & job description to generate role-targeted personalized questions with Sarah Jenkins.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/interview/setup")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all shrink-0 hover:scale-[1.02]"
          >
            <span>Prepare New Interview</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
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
                  placeholder="e.g. Data Science, Backend Engineering"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Bio / Goals</label>
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

        {/* PHASE 2: RESUME INTELLIGENCE & INTERVIEW PREPARATION WORKSPACE */}
        <div className="space-y-8">
          {/* STEP 1 & STEP 2: RESUME UPLOAD & PARSED PROFILE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Step 1: Upload Card */}
            <div className="lg:col-span-5 glass-panel p-6 sm:p-8 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                    1
                  </div>
                  <h2 className="text-lg font-bold text-white">Upload Your Resume</h2>
                </div>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Upload your resume in PDF or DOCX format. Our extraction pipeline parses your skills, projects, and domain experience to personalize mock interview questions.
                </p>

                {/* Upload Zone */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.docx"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-white/[0.01] hover:bg-indigo-500/[0.02] flex flex-col items-center justify-center group"
                >
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
                    {isUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {isUploading ? "Extracting & Parsing Resume..." : "Click to select or drop resume"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Supports PDF or DOCX (Max 10MB)</p>
                </div>

                {uploadError && (
                  <p className="text-xs text-red-400 mt-3 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Uploaded resumes list */}
              {resumes.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Active Resumes
                  </span>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {resumes.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedResume(r)}
                        className={`p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer border transition-colors ${
                          selectedResume?.id === r.id
                            ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-200"
                            : "bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                          <span className="truncate">{r.original_filename}</span>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 shrink-0">
                          {r.file_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Extracted Information Preview */}
            <div className="lg:col-span-7 glass-panel p-6 sm:p-8 rounded-2xl flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xs">
                    2
                  </div>
                  <h2 className="text-lg font-bold text-white">Extracted Candidate Intelligence</h2>
                </div>
                {selectedResume && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <Check className="h-3 w-3" /> Ready for Interview
                  </span>
                )}
              </div>

              {selectedResume?.profile ? (
                <div className="space-y-4 text-xs flex-1">
                  {/* Candidate Identity */}
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Candidate Name</span>
                      <span className="text-slate-200 font-medium">{selectedResume.profile.candidate_name || "Extracted from resume"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Contact Email</span>
                      <span className="text-slate-200 font-medium truncate block">{selectedResume.profile.email || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Phone</span>
                      <span className="text-slate-200 font-medium">{selectedResume.profile.phone || "—"}</span>
                    </div>
                  </div>

                  {/* Skills Tags */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-300 block mb-2 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-indigo-400" />
                      Detected Skills & Technologies ({selectedResume.profile.skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedResume.profile.skills.length > 0 ? (
                        selectedResume.profile.skills.map((skill, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-xs italic">No specific catalog skills detected in raw text.</span>
                      )}
                    </div>
                  </div>

                  {/* Education & Projects Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-cyan-400" />
                        Education
                      </span>
                      {selectedResume.profile.education.length > 0 ? (
                        <p className="text-slate-300 text-xs line-clamp-3 leading-relaxed">
                          {selectedResume.profile.education[0]}
                        </p>
                      ) : (
                        <p className="text-slate-500 text-xs italic">Educational background extracted</p>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 flex items-center gap-1">
                        <FileCode className="h-3.5 w-3.5 text-purple-400" />
                        Project Highlights
                      </span>
                      {selectedResume.profile.projects.length > 0 ? (
                        <p className="text-slate-300 text-xs line-clamp-3 leading-relaxed">
                          {selectedResume.profile.projects[0]}
                        </p>
                      ) : (
                        <p className="text-slate-500 text-xs italic">Projects extracted</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-white/5 rounded-xl bg-slate-900/20">
                  <FileText className="h-10 w-10 text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No Resume Loaded Yet</p>
                  <p className="text-xs text-slate-500 mt-1">Upload your PDF or DOCX resume on the left to extract skills and project context.</p>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3 & STEP 4: INTERVIEW CONFIGURATION (DOMAIN, COMPANY, DIFFICULTY) */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs">
                3
              </div>
              <h2 className="text-lg font-bold text-white">Target Interview Configuration</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Domain Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-indigo-400" />
                  Target Engineering Domain
                </label>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  {DOMAIN_OPTIONS.map((d, i) => (
                    <option key={i} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-cyan-400" />
                  Target Company (Optional)
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Google, Amazon, Microsoft"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-purple-400" />
                  Interview Difficulty Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Low", "Medium", "High"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        difficulty === lvl
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                          : "bg-slate-900/60 text-slate-400 border-white/10 hover:border-white/20"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Trigger */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10">
              <div className="text-xs text-slate-400">
                <span>Selected Context: </span>
                <span className="text-white font-medium">{selectedDomain}</span>
                {companyName && (
                  <span>
                    {" "}@ <span className="text-white font-medium">{companyName}</span>
                  </span>
                )}
                <span> • Level: </span>
                <span className="text-indigo-400 font-semibold">{difficulty}</span>
              </div>

              <button
                onClick={handleCreateSessionAndGenerate}
                disabled={isCreatingSession || isGeneratingQuestions}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
              >
                {isCreatingSession || isGeneratingQuestions ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating Personalized Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-indigo-200" />
                    <span>Create Session & Generate AI Questions</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* STEP 5 & STEP 6: GENERATED INTERVIEW QUESTIONS DISPLAY */}
          {questions.length > 0 && (
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border-indigo-500/30 shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                    4
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Generated Interview Questions ({questions.length})</h2>
                    <p className="text-xs text-slate-400">Personalized tailored questions ready for Phase 3 AI Interview Simulation</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentSession && (
                    <button
                      onClick={() => router.push(`/interview/${currentSession.id}`)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
                    >
                      <Bot className="h-4 w-4" />
                      <span>Enter Live AI Interview Room</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={handleCreateSessionAndGenerate}
                    disabled={isGeneratingQuestions}
                    className="px-3 py-2 rounded-xl glass-panel text-xs text-slate-300 hover:text-white flex items-center gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingQuestions ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl bg-slate-900/70 border border-white/10 hover:border-indigo-500/30 transition-colors flex items-start gap-3.5"
                  >
                    <span className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-mono font-bold text-xs shrink-0 mt-0.5">
                      {q.sequence_number}
                    </span>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          {q.category}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/5 text-slate-400">
                          {q.difficulty} Difficulty
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Source: {q.source}
                        </span>
                      </div>
                      <p className="text-sm text-slate-100 font-medium leading-relaxed">
                        {q.question_text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
