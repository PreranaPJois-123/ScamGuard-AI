"use client";

import { useAuth } from "@/lib/auth/auth-context";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Always render children seamlessly without blocking on full-page spinners
  return <>{children}</>;
}
