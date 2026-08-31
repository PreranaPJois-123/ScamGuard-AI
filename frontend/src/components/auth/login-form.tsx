"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { loginSchema } from "@/lib/validation/auth-schemas";
import { getSafeRedirectPath } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { RefreshCw } from "lucide-react";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWakingServer, setIsWakingServer] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Proactively wake up backend from standby on page mount
  useEffect(() => {
    fetch("/backend-api/api/v1/health").catch(() => {});
  }, []);

  // Track elapsed time during submission
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSubmitting) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setSecondsElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isSubmitting]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSubmitting(false);
    setIsWakingServer(false);
    setFormError("Sign-in cancelled. You can click 'Sign in' to try again.");
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    setIsWakingServer(false);
    abortControllerRef.current = new AbortController();

    // Show server wake-up notice if request takes > 2.5s
    const wakeTimer = setTimeout(() => {
      setIsWakingServer(true);
    }, 2500);

    try {
      await login(result.data);
      router.push(getSafeRedirectPath(searchParams.get("redirect")));
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else if (error instanceof Error && error.name === "AbortError") {
        setFormError("Request was cancelled.");
      } else {
        setFormError("Connection to backend server timed out. The server was booting from sleep — please click 'Sign in' again now.");
      }
    } finally {
      clearTimeout(wakeTimer);
      setIsWakingServer(false);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && <Alert variant="error">{formError}</Alert>}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        placeholder="you@example.com"
        disabled={isSubmitting}
      />

      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        placeholder="••••••••"
        disabled={isSubmitting}
      />

      <div className="flex flex-col gap-2 mt-1">
        <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
          {isWakingServer
            ? `Connecting to server (${secondsElapsed}s)...`
            : isSubmitting
              ? "Signing in..."
              : "Sign in"}
        </Button>

        {isSubmitting && secondsElapsed >= 8 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Taking longer than expected? Click here to cancel & retry
          </Button>
        )}
      </div>

      {isWakingServer && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
          <p className="text-xs font-medium text-amber-500">
            Cloud backend is waking from standby ({secondsElapsed}s elapsed).
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Free-tier instances spin down when idle. Your session will load as soon as the service connects.
          </p>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
