import { apiRequest } from "@/lib/api/client";
import type { AnalysisResult } from "@/types";

export function analyzeMessage(text: string): Promise<AnalysisResult> {
  return apiRequest<AnalysisResult>("/messages/analyze", { method: "POST", body: { text, input_type: "TEXT" } });
}

export function getHistory(skip = 0, limit = 50): Promise<AnalysisResult[]> {
  return apiRequest<AnalysisResult[]>(`/messages/history?skip=${skip}&limit=${limit}`);
}

export function clearHistory(): Promise<void> {
  return apiRequest<void>("/messages/history", { method: "DELETE" });
}

export function deleteMessage(id: string): Promise<void> {
  return apiRequest<void>(`/messages/${id}`, { method: "DELETE" });
}

export function submitFeedback(predictionId: string, isAccurate: boolean): Promise<AnalysisResult> {
  return apiRequest<AnalysisResult>(`/messages/${predictionId}/feedback`, {
    method: "PATCH",
    body: { is_accurate: isAccurate },
  });
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

  return apiRequest<AnalysisResult>("/messages/scan", {
    method: "POST",
    body: formData,
  });
}
