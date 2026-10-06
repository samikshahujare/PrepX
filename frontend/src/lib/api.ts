import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

// Request interceptor to attach bearer token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("prepx_access_token");
      if (token) {
        if (config.headers && typeof (config.headers as any).set === "function") {
          (config.headers as any).set("Authorization", `Bearer ${token}`);
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for automatic token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      if (typeof window !== "undefined") {
        const refreshToken = localStorage.getItem("prepx_refresh_token");
        if (refreshToken) {
          try {
            const refreshRes = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refresh_token: refreshToken,
            });
            if (refreshRes.data.success) {
              const newAccessToken = refreshRes.data.data.access_token;
              localStorage.setItem("prepx_access_token", newAccessToken);
              if (originalRequest.headers && typeof originalRequest.headers.set === "function") {
                originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
              } else {
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              }
              return apiClient(originalRequest);
            }
          } catch (refreshErr) {
            localStorage.removeItem("prepx_access_token");
            localStorage.removeItem("prepx_refresh_token");
            window.location.href = "/login";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);
