"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: ReactNode }) {
  // Proactively wake up Render cloud backend in background on initial page load
  useEffect(() => {
    try {
      fetch("/backend-api/api/v1/health", { cache: "no-store" }).catch(() => {});
      fetch("https://scamguard-app-service.onrender.com/api/v1/health", { cache: "no-store", mode: "cors" }).catch(() => {});
    } catch {}
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
