import { apiClient } from "./api";
import { User, ApiResponse, TokenResponse } from "@/types";

export const authService = {
  saveTokens(tokens: TokenResponse) {
    if (typeof window !== "undefined") {
      localStorage.setItem("prepx_access_token", tokens.access_token);
      localStorage.setItem("prepx_refresh_token", tokens.refresh_token);
    }
  },

  clearTokens() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("prepx_access_token");
      localStorage.removeItem("prepx_refresh_token");
    }
  },

  isAuthenticated(): boolean {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("prepx_access_token");
    }
    return false;
  },

  async register(email: string, password: string, fullName: string): Promise<User> {
    const res = await apiClient.post<ApiResponse<User>>("/auth/register", {
      email,
      password,
      full_name: fullName,
    });
    return res.data.data;
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await apiClient.post<ApiResponse<TokenResponse>>("/auth/login", {
      email,
      password,
    });
    this.saveTokens(res.data.data);
    return res.data.data;
  },

  async getCurrentUser(): Promise<User> {
    const res = await apiClient.get<ApiResponse<User>>("/users/me");
    return res.data.data;
  },

  async updateProfile(profileData: {
    full_name?: string;
    target_domain?: string;
    experience_level?: string;
    bio?: string;
  }) {
    const res = await apiClient.put("/users/me/profile", profileData);
    return res.data.data;
  },

  async logout(): Promise<void> {
    if (typeof window !== "undefined") {
      const refreshToken = localStorage.getItem("prepx_refresh_token");
      if (refreshToken) {
        try {
          await apiClient.post("/auth/logout", { refresh_token: refreshToken });
        } catch (_) {}
      }
      this.clearTokens();
    }
  },
};
