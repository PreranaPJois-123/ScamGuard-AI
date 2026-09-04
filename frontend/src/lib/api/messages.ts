import { apiRequest } from "@/lib/api/client";
import { fallbackClientAnalyze } from "@/lib/api/client-analyzer";
import type { AnalysisResult } from "@/types";

const LOCAL_HISTORY_KEY = "scamguard_local_history";

function getLocalHistory(): AnalysisResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as AnalysisResult[]) : [];
  } catch {
    return [];
  }
}

function saveToLocalHistory(item: AnalysisResult): void {
  if (typeof window === "undefined") return;
  try {
    const history = getLocalHistory();
    const updated = [item, ...history.filter((h) => h.id !== item.id)].slice(0, 100);
    window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

export async function analyzeMessage(text: string): Promise<AnalysisResult> {
  try {
    const result = await apiRequest<AnalysisResult>("/messages/analyze", {
      method: "POST",
      body: { text, input_type: "TEXT" },
    });
    saveToLocalHistory(result);
    return result;
  } catch (err: unknown) {
    // If backend returns 503, network failure, or timeout, immediately execute resilient client-side AI analysis
    const fallback = fallbackClientAnalyze(text, "TEXT");
    saveToLocalHistory(fallback);
    return fallback;
  }
}

export async function getHistory(skip = 0, limit = 50): Promise<AnalysisResult[]> {
  try {
    const serverHistory = await apiRequest<AnalysisResult[]>(`/messages/history?skip=${skip}&limit=${limit}`);
    if (serverHistory && serverHistory.length > 0) {
      return serverHistory;
    }
    return getLocalHistory().slice(skip, skip + limit);
  } catch {
    return getLocalHistory().slice(skip, skip + limit);
  }
}

export async function clearHistory(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LOCAL_HISTORY_KEY);
  }
  try {
    await apiRequest<void>("/messages/history", { method: "DELETE" });
  } catch {}
}

export async function deleteMessage(id: string): Promise<void> {
  if (typeof window !== "undefined") {
    const history = getLocalHistory().filter((h) => h.id !== id);
    window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
  }
  try {
    await apiRequest<void>(`/messages/${id}`, { method: "DELETE" });
  } catch {}
}

export async function submitFeedback(predictionId: string, isAccurate: boolean): Promise<AnalysisResult> {
  try {
    return await apiRequest<AnalysisResult>(`/messages/${predictionId}/feedback`, {
      method: "PATCH",
      body: { is_accurate: isAccurate },
    });
  } catch {
    // Return updated local copy if backend is unreachable
    const history = getLocalHistory();
    const item = history.find((h) => h.id === predictionId);
    if (item) {
      item.user_feedback = isAccurate;
      saveToLocalHistory(item);
      return item;
    }
    return fallbackClientAnalyze("Feedback updated", "TEXT");
  }
}

export async function scanFile(file: File | null, text: string | null, inputType: string): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("input_type", inputType);
  if (file) {
    formData.append("file", file);
  }
  if (text) {
    formData.append("text", text);
  }

  try {
    const result = await apiRequest<AnalysisResult>("/messages/scan", {
      method: "POST",
      body: formData,
    });
    saveToLocalHistory(result);
    return result;
  } catch {
    const sampleText = text || (file ? `Scanned attachment: ${file.name}` : "Uploaded file");
    const fallback = fallbackClientAnalyze(sampleText, inputType);
    saveToLocalHistory(fallback);
    return fallback;
  }
}
