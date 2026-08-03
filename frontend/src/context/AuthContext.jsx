import { createContext, useState, useEffect, useCallback } from "react";

import { getMe, logout as logoutApi } from "../services/authService";

import { clearSettingsCache } from "../services/settingsService";
export const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const isAuthenticated = !!token && !!user;

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((res) => setUser(res.data.data))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);
  const login = useCallback((token, user) => {
    clearSettingsCache();
    localStorage.setItem("token", token);
    setToken(token);
    setUser(user);
  }, []);
  const logout = useCallback(() => {
    clearSettingsCache();
    logoutApi().catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, isAuthenticated, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
