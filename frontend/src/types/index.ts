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
  feedback?: Record<string, any> | InterviewFeedbackReport | null;
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
  duration_minutes?: number;
  deadline_at?: string | null;
  remaining_seconds?: number | null;
}

export interface AnswerQualityEvaluation {
  score?: number;
  relevance?: number;
  completeness?: number;
  technical_depth?: number;
  sentiment?: string;
  interviewer_action?: string;
  feedback?: string;
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
  duration_minutes?: number;
  remaining_seconds?: number | null;
  deadline_at?: string | null;
  topic_coverage?: Record<string, any>;
  answer_quality?: AnswerQualityEvaluation | null;
}

export interface InterviewRuntimeState {
  session_id: string;
  interview_status: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes?: number;
  paused_at?: string | null;
  total_paused_seconds?: number;
  is_paused?: boolean;
  remaining_seconds?: number;
  deadline_at?: string | null;
  current_question_index: number;
  total_questions: number;
  current_question?: Question | null;
  transcripts: InterviewTranscript[];
  feedback?: Record<string, any>;
  topic_coverage?: Record<string, any>;
}

export interface FeedbackSkillItem {
  skill: string;
  importance: string;
  what_to_learn: string;
  why_it_matters: string;
  what_was_misunderstood: string;
  stronger_answer_guide: string;
  suggested_practice_question: string;
}

export interface InterviewFeedbackReport {
  overall_score: number;
  overall_explanation: string;
  category_scores: Record<string, number>;
  category_assessments: Record<string, string>;
  strengths: string[];
  weaknesses_and_mistakes: string[];
  project_and_resume_evaluation: string;
  skills_to_improve: FeedbackSkillItem[];
  better_answer_guidance: Array<{
    question: string;
    candidate_answer?: string;
    candidate_answer_summary?: string;
    model_answer_structure?: string;
    strong_example_answer?: string;
    recommended_model_answer?: string;
  }>;
  action_plan: string[];
  interview_summary: {
    domain?: string;
    company?: string;
    target_role?: string;
    interview_mode?: string;
    difficulty?: string;
    duration_minutes?: number;
    actual_elapsed_minutes?: number;
    questions_completed?: number;
    completion_status?: string;
    topics_covered?: string[];
    topics_unassessed?: string[];
    [key: string]: any;
  };
  is_preliminary?: boolean;
}

// ==========================================
// Group Discussion (GD) Interfaces
// ==========================================

export interface GDParticipant {
  id: string;
  session_id: string;
  user_id?: string | null;
  guest_id?: string | null;
  display_name: string;
  is_host: boolean;
  role?: string | null;
  is_guest?: boolean;
  is_muted: boolean;
  joined_at: string;
  left_at?: string | null;
}

export interface GDSession {
  id: string;
  session_code: string;
  creator_id: string;
  topic: string;
  topic_category: string;
  topic_context?: string | null;
  duration_minutes: number;
  max_participants: number;
  status: "created" | "waiting_for_participants" | "in_progress" | "completed" | "cancelled";
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
  participants: GDParticipant[];
}

export interface GDInvitation {
  token: string;
  join_url: string;
  whatsapp_share_url: string;
  email_share_subject: string;
  email_share_body: string;
  expires_at: string;
  is_public?: boolean;
}

export interface GDTranscriptSegment {
  id?: string;
  session_id?: string;
  participant_id?: string | null;
  speaker_name: string;
  is_moderator: boolean;
  message: string;
  timestamp_seconds: number;
  sequence_number?: number;
  created_at?: string;
}

export interface GDEvaluation {
  id: string;
  session_id: string;
  participant_id: string;
  user_id?: string | null;
  overall_score: number;
  category_scores: Record<string, number>;
  strengths: string[];
  areas_for_improvement: string[];
  communication_feedback: string;
  reasoning_feedback: string;
  listening_feedback: string;
  missed_opportunities: string[];
  example_strong_response: string;
  personalized_plan: {
    drills?: string[];
    focus_areas?: string[];
    recommended_topics?: string[];
    [key: string]: any;
  };
  created_at: string;
}

export interface GDTopicData {
  topic: string;
  category: string;
  briefing: string;
  key_perspectives: string[];
}

