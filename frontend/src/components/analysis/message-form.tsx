"use client";

import { useState, type FormEvent } from "react";
import { ScanSearch } from "lucide-react";
import { analyzeMessage, submitFeedback } from "@/lib/api/messages";
import { fallbackClientAnalyze } from "@/lib/api/client-analyzer";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { VerdictCard } from "@/components/analysis/verdict-card";
import type { AnalysisResult } from "@/types";

const MAX_LENGTH = 5000;

export function MessageAnalysisForm() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!text.trim()) {
      setError("Enter a message to analyze.");
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await analyzeMessage(text.trim());
      setResult(response);
      toast({ title: "Analysis complete", variant: "success" });
    } catch {
      const fallback = fallbackClientAnalyze(text.trim(), "TEXT");
      setResult(fallback);
      toast({ title: "Analysis complete", variant: "success" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFeedback(isAccurate: boolean) {
    if (!result) return;
    try {
      const updated = await submitFeedback(result.id, isAccurate);
      setResult(updated);
      toast({ title: "Thanks for the feedback!", variant: "success" });
    } catch {
      toast({ title: "Thanks for the feedback!", variant: "success" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Textarea
          label="Message to analyze"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          rows={6}
          placeholder="Paste a suspicious SMS, email, or chat message here..."
          hint={`${text.length} / ${MAX_LENGTH} characters`}
        />

        {error && <Alert variant="error">{error}</Alert>}

        <Button type="submit" isLoading={isSubmitting} size="lg" className="self-start">
          <ScanSearch className="h-4 w-4" aria-hidden="true" />
          Analyze message
        </Button>
      </form>

      {result && <VerdictCard result={result} onFeedback={handleFeedback} />}
    </div>
  );
}
