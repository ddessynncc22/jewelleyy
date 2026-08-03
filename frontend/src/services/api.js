import axios from "axios";

// Empty by default, which keeps every request relative and therefore same-origin:
// Vite proxies /api and /uploads in dev, Caddy does the same in production.
// Set VITE_API_URL only when the API lives on a different origin.
export const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
export default api;
