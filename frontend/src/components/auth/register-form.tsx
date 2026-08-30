"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { registerSchema } from "@/lib/validation/auth-schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWakingServer, setIsWakingServer] = useState(false);

  // Proactively wake up backend from standby on page load
  useEffect(() => {
    fetch("/backend-api/api/v1/health").catch(() => {});
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = registerSchema.safeParse({ email, password, confirmPassword });
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

    // Show friendly server wake-up notice if request takes > 2.5s
    const wakeTimer = setTimeout(() => {
      setIsWakingServer(true);
    }, 2500);

    try {
      await register({ email: result.data.email, password: result.data.password });
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(
          error.errorCode === "CONFLICT"
            ? "An account with this email already exists. Try signing in instead."
            : error.message,
        );
      } else {
        setFormError("Something went wrong. Please try again.");
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
      />

      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        placeholder="At least 8 characters"
        hint="Must contain at least 8 characters, one number, and one uppercase letter."
      />

      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmPassword}
        placeholder="Repeat password"
      />

      <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full" size="lg">
        {isWakingServer ? "Creating account (waking cloud server)..." : "Create account"}
      </Button>

      {isWakingServer && (
        <p className="text-center text-xs text-amber-500 animate-pulse">
          Free-tier cloud backend is booting from sleep. Please wait a moment...
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
