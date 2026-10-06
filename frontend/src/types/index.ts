export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  target_domain?: string | null;
  experience_level?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  profile?: UserProfile | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ResumeProfile {
  id: string;
  resume_id: string;
  candidate_name?: string | null;
  email?: string | null;
  phone?: string | null;
  skills: string[];
  education: string[];
  experience: string[];
  projects: string[];
  certifications: string[];
  raw_extracted_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_text?: string | null;
  upload_status: string;
  created_at: string;
  updated_at: string;
  profile?: ResumeProfile | null;
}

export interface Question {
  id: string;
  session_id: string;
  question_text: string;
  category: string;
  difficulty: string;
  source: string;
  sequence_number: number;
  is_asked?: boolean;
  created_at: string;
}

export interface InterviewTranscript {
  id: string;
  session_id: string;
  question_id?: string | null;
  speaker: "interviewer" | "candidate" | "system";
  message: string;
  sequence_number: number;
  is_followup: boolean;
  created_at: string;
}

export interface JDAnalysisResult {
  company?: string | null;
  target_role?: string | null;
  domain: string;
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  qualifications: string[];
  experience_requirements?: string | null;
  keywords: string[];
  raw_text: string;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  resume_id?: string | null;
  domain: string;
  company?: string | null;
  target_role?: string | null;
  interview_mode?: "Company-Specific" | "Role-Specific";
  difficulty: "Low" | "Medium" | "High";
  duration_minutes?: number;
  allowed_attempts?: number;
  current_attempt?: number;
  status: string;
  interview_status?: string;
  started_at?: string | null;
  ended_at?: string | null;
  current_question_index?: number;
  job_description?: string | null;
  jd_analysis?: JDAnalysisResult | Record<string, any>;
  created_at: string;
  updated_at: string;
  questions?: Question[];
  transcripts?: InterviewTranscript[];
}

export type InterviewState =
  | "idle"
  | "preparing"
  | "active"
  | "listening"
  | "processing"
  | "speaking"
  | "paused"
  | "completed"
  | "error";

export interface InterviewStartResponse {
  session_id: string;
  interview_status: string;
  current_question?: Question | null;
  interviewer_message: string;
  current_question_index: number;
  total_questions: number;
  started_at: string;
}

export interface InterviewResponseResult {
  session_id: string;
  interview_status: string;
  is_followup: boolean;
  current_question?: Question | null;
  interviewer_message: string;
  current_question_index: number;
  total_questions: number;
  is_completed: boolean;
}

export interface InterviewRuntimeState {
  session_id: string;
  interview_status: string;
  started_at?: string | null;
  ended_at?: string | null;
  current_question_index: number;
  total_questions: number;
  current_question?: Question | null;
  transcripts: InterviewTranscript[];
}
