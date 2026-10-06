import { apiClient } from "./api";
import {
  ApiResponse,
  Resume,
  InterviewSession,
  Question,
  InterviewStartResponse,
  InterviewResponseResult,
  InterviewRuntimeState,
  InterviewTranscript,
  JDAnalysisResult,
} from "@/types";

export const interviewService = {
  async uploadResume(file: File): Promise<Resume> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiClient.post<ApiResponse<Resume>>("/resumes/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data.data;
  },

  async parseJDText(text: string): Promise<JDAnalysisResult> {
    const res = await apiClient.post<ApiResponse<JDAnalysisResult>>(
      "/interview-sessions/parse-jd-text",
      { text }
    );
    return res.data.data;
  },

  async parseJDFile(file: File): Promise<JDAnalysisResult> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiClient.post<ApiResponse<JDAnalysisResult>>(
      "/interview-sessions/parse-jd-file",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return res.data.data;
  },

  async listResumes(): Promise<Resume[]> {
    const res = await apiClient.get<ApiResponse<Resume[]>>("/resumes");
    return res.data.data;
  },

  async getResume(resumeId: string): Promise<Resume> {
    const res = await apiClient.get<ApiResponse<Resume>>(`/resumes/${resumeId}`);
    return res.data.data;
  },

  async createInterviewSession(data: {
    domain: string;
    company?: string;
    target_role?: string;
    interview_mode?: "Company-Specific" | "Role-Specific";
    difficulty: "Low" | "Medium" | "High";
    duration_minutes?: number;
    allowed_attempts?: number;
    resume_id?: string;
    job_description?: string;
    jd_analysis?: any;
  }): Promise<InterviewSession> {
    const res = await apiClient.post<ApiResponse<InterviewSession>>(
      "/interview-sessions/sessions",
      data
    );
    return res.data.data;
  },

  async listInterviewSessions(): Promise<InterviewSession[]> {
    const res = await apiClient.get<ApiResponse<InterviewSession[]>>(
      "/interview-sessions/sessions"
    );
    return res.data.data;
  },

  async getInterviewSession(sessionId: string): Promise<InterviewSession> {
    const res = await apiClient.get<ApiResponse<InterviewSession>>(
      `/interview-sessions/sessions/${sessionId}`
    );
    return res.data.data;
  },

  async generateQuestions(sessionId: string, count: number = 5): Promise<Question[]> {
    const res = await apiClient.post<ApiResponse<Question[]>>(
      `/interview-sessions/sessions/${sessionId}/questions/generate`,
      { count }
    );
    return res.data.data;
  },

  async getQuestions(sessionId: string): Promise<Question[]> {
    const res = await apiClient.get<ApiResponse<Question[]>>(
      `/interview-sessions/sessions/${sessionId}/questions`
    );
    return res.data.data;
  },

  // ---------------- Phase 3 Real-time Mock Interview Runtime ----------------

  async startInterviewSession(sessionId: string): Promise<InterviewStartResponse> {
    const res = await apiClient.post<ApiResponse<InterviewStartResponse>>(
      `/interview-sessions/sessions/${sessionId}/start`
    );
    return res.data.data;
  },

  async submitCandidateResponse(
    sessionId: string,
    candidateResponse: string
  ): Promise<InterviewResponseResult> {
    const res = await apiClient.post<ApiResponse<InterviewResponseResult>>(
      `/interview-sessions/sessions/${sessionId}/response`,
      { candidate_response: candidateResponse }
    );
    return res.data.data;
  },

  async advanceNextQuestion(sessionId: string): Promise<InterviewResponseResult> {
    const res = await apiClient.post<ApiResponse<InterviewResponseResult>>(
      `/interview-sessions/sessions/${sessionId}/next`
    );
    return res.data.data;
  },

  async pauseInterviewSession(sessionId: string): Promise<InterviewSession> {
    const res = await apiClient.post<ApiResponse<InterviewSession>>(
      `/interview-sessions/sessions/${sessionId}/pause`
    );
    return res.data.data;
  },

  async resumeInterviewSession(sessionId: string): Promise<InterviewSession> {
    const res = await apiClient.post<ApiResponse<InterviewSession>>(
      `/interview-sessions/sessions/${sessionId}/resume`
    );
    return res.data.data;
  },

  async endInterviewSession(sessionId: string): Promise<InterviewSession> {
    const res = await apiClient.post<ApiResponse<InterviewSession>>(
      `/interview-sessions/sessions/${sessionId}/end`
    );
    return res.data.data;
  },

  async getInterviewRuntimeState(sessionId: string): Promise<InterviewRuntimeState> {
    const res = await apiClient.get<ApiResponse<InterviewRuntimeState>>(
      `/interview-sessions/sessions/${sessionId}/runtime`
    );
    return res.data.data;
  },

  async getInterviewTranscripts(sessionId: string): Promise<InterviewTranscript[]> {
    const res = await apiClient.get<ApiResponse<InterviewTranscript[]>>(
      `/interview-sessions/sessions/${sessionId}/transcripts`
    );
    return res.data.data;
  },
};
