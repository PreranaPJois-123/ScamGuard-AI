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

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Synchronously initialize user from localStorage cache on frame 0 to eliminate initial blocking spinners
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // If no session exists or cached user exists, render immediately without full-page spinner
    return hasSession() && !getCachedUser();
  });

  const refreshUser = useCallback(async () => {
    if (!hasSession()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      setCachedUser(currentUser);
    } catch {
      // If token expired or invalid, clear session
      if (!hasSession()) {
        clearTokens();
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    // Guard against slow cloud cold starts by lifting any loading state after 3 seconds max
    const timeoutId = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 3000);

    (async () => {
      await refreshUser();
      if (isMounted) {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const tokens = await authApi.login(payload);
    setTokens(tokens);
    const currentUser = await authApi.getCurrentUser();
    setUser(currentUser);
    setCachedUser(currentUser);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
    await login({ email: payload.email, password: payload.password });
  }, [login]);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {}
    }
    clearTokens();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
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
