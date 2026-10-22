import { apiClient } from "./api";
import {
  ApiResponse,
  GDSession,
  GDParticipant,
  GDInvitation,
  GDTranscriptSegment,
  GDEvaluation,
  GDTopicData,
} from "@/types";

export const gdService = {
  async createSession(payload: {
    topic: string;
    topic_category?: string;
    topic_context?: string;
    duration_minutes?: number;
    max_participants?: number;
  }): Promise<GDSession> {
    const res = await apiClient.post<ApiResponse<GDSession>>("/gd/sessions", payload);
    return res.data.data!;
  },

  async listSessions(): Promise<GDSession[]> {
    const res = await apiClient.get<ApiResponse<GDSession[]>>("/gd/sessions");
    return res.data.data || [];
  },

  async getSession(identifier: string, participantId?: string): Promise<GDSession> {
    const params = participantId ? { participant_id: participantId } : undefined;
    const res = await apiClient.get<ApiResponse<GDSession>>(`/gd/sessions/${identifier}`, { params });
    return res.data.data!;
  },

  async generateTopic(payload: {
    category: string;
    role_context?: string;
    company?: string;
  }): Promise<GDTopicData> {
    const res = await apiClient.post<ApiResponse<GDTopicData>>("/gd/sessions/preview/generate-topic", payload);
    return res.data.data!;
  },

  async createInvitation(sessionId: string): Promise<GDInvitation> {
    const res = await apiClient.post<ApiResponse<GDInvitation>>(`/gd/sessions/${sessionId}/invitations`);
    return res.data.data!;
  },

  async validateInvitation(token: string): Promise<any> {
    const res = await apiClient.get<ApiResponse<any>>(`/gd/invitations/${token}/validate`);
    return res.data.data!;
  },

  async joinWithInvitation(
    token: string,
    payload: { display_name: string; guest_id?: string }
  ): Promise<GDParticipant> {
    const res = await apiClient.post<ApiResponse<GDParticipant>>(`/gd/invitations/${token}/join`, payload);
    return res.data.data!;
  },

  async getSessionTranscripts(sessionId: string, participantId?: string): Promise<GDTranscriptSegment[]> {
    const params = participantId ? { participant_id: participantId } : undefined;
    const res = await apiClient.get<ApiResponse<GDTranscriptSegment[]>>(`/gd/sessions/${sessionId}/transcripts`, { params });
    return res.data.data || [];
  },

  async getMyEvaluation(sessionId: string, participantId?: string): Promise<GDEvaluation> {
    const params = participantId ? { participant_id: participantId } : undefined;
    const res = await apiClient.get<ApiResponse<GDEvaluation>>(`/gd/sessions/${sessionId}/evaluations/me`, { params });
    return res.data.data!;
  },

  async evaluateAllParticipants(sessionId: string): Promise<GDEvaluation[]> {
    const res = await apiClient.post<ApiResponse<GDEvaluation[]>>(`/gd/sessions/${sessionId}/evaluate`);
    return res.data.data || [];
  },
};
