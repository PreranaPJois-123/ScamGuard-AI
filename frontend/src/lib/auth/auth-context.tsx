"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "@/lib/api/auth";
import {
  clearTokens,
  getCachedUser,
  getRefreshToken,
  hasSession,
  setCachedUser,
  setTokens,
} from "@/lib/auth/token-storage";
import type { LoginPayload, RegisterPayload, User } from "@/types";

const DEMO_USER: User = {
  id: "analyst-session",
  email: "security.analyst@scamguard.ai",
  full_name: "Security Analyst",
  role: "user",
  is_active: true,
  created_at: new Date().toISOString(),
};

interface AuthContextValue {
  user: User;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Synchronously initialize user from localStorage or active demo session for instant frame-0 rendering
  const [user, setUser] = useState<User>(() => getCachedUser() || DEMO_USER);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshUser = useCallback(async () => {
    if (!hasSession()) {
      return;
    }
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      setCachedUser(currentUser);
    } catch {
      // Keep existing session active without disrupting the user
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const tokens = await authApi.login(payload);
      setTokens(tokens);
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      setCachedUser(currentUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      await authApi.register(payload);
      await login({ email: payload.email, password: payload.password });
    } finally {
      setIsLoading(false);
    }
  }, [login]);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {}
    }
    clearTokens();
    setUser(DEMO_USER);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: true,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
