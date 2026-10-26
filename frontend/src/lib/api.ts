import axios from "axios";

export const getApiBaseUrl = (): string => {
  // If running in the browser on localhost and pointing to a remote backend,
  // use relative '/api/v1' so Next.js server proxies requests, bypassing browser CORS restrictions
  // until the remote backend includes localhost:3000 in its CORS_ORIGINS.
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (isLocalhost && envApiUrl && !envApiUrl.includes("localhost") && !envApiUrl.includes("127.0.0.1")) {
      return "/api/v1";
    }
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    if (isLocalhost) {
      return "http://localhost:8000/api/v1";
    }
    // In production web client without NEXT_PUBLIC_API_URL, use relative /api/v1 rather than guessing port 8000
    console.warn(
      "[PrepX Warning] NEXT_PUBLIC_API_URL is not set. Falling back to relative '/api/v1'. Please configure NEXT_PUBLIC_API_URL in your production environment."
    );
    return "/api/v1";
  }
  if (process.env.NODE_ENV === "production") {
    return "";
  }
  return "http://localhost:8000/api/v1";
};

export const API_BASE_URL = getApiBaseUrl();

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
