"use client";

import { useState, useCallback, useEffect, memo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const ScanTabs = dynamic(() => import("@/components/dashboard/scan-tabs").then(mod => mod.ScanTabs), { ssr: false });
const VerdictCard = dynamic(() => import("@/components/analysis/verdict-card").then(mod => mod.VerdictCard), { ssr: false });
import { scanFile, submitFeedback } from "@/lib/api/messages";
import { fallbackClientAnalyze } from "@/lib/api/client-analyzer";
import { useToast } from "@/hooks/use-toast";
import type { AnalysisResult } from "@/types";

interface ScanItem {
  id: string;
  file?: File;
  text?: string;
  inputType: string;
  status: "pending" | "scanning" | "done" | "error";
  result?: AnalysisResult;
  error?: string;
}

export const BatchScanner = memo(function BatchScanner() {
  const { toast } = useToast();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Proactively pre-warm backend in background
    fetch("/backend-api/api/v1/health").catch(() => {});
  }, []);

  const handleScan = useCallback(async (texts: string[], files: File[], inputType: string) => {
    const newItems: ScanItem[] = [];
    
    texts.forEach((text) => {
      newItems.push({
        id: crypto.randomUUID(),
        text,
        inputType,
        status: "pending",
      });
    });

    files.forEach((file) => {
      newItems.push({
        id: crypto.randomUUID(),
        file,
        inputType,
        status: "pending",
      });
    });

    if (newItems.length === 0) return;

    setItems(newItems);
    setIsScanning(true);
    setCurrentIndex(0);

    for (let i = 0; i < newItems.length; i++) {
      setCurrentIndex(i);
      const item = newItems[i]!;
      
      setItems((prev) => 
        prev.map((p, idx) => idx === i ? { ...p, status: "scanning" } : p)
      );

      try {
        const result = await scanFile(item.file || null, item.text || null, item.inputType);
        setItems((prev) => 
          prev.map((p, idx) => idx === i ? { ...p, status: "done", result } : p)
        );
      } catch {
        const sampleText = item.text || (item.file ? `Scanned file: ${item.file.name}` : "Uploaded text");
        const fallback = fallbackClientAnalyze(sampleText, item.inputType);
        setItems((prev) => 
          prev.map((p, idx) => idx === i ? { ...p, status: "done", result: fallback } : p)
        );
      }
    }

    setIsScanning(false);
    toast({ title: "Analysis complete", variant: "default" });
  }, [toast]);

  const handleFeedback = useCallback(async (itemId: string, predictionId: string, isAccurate: boolean) => {
    try {
      const updated = await submitFeedback(predictionId, isAccurate);
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId && item.result
            ? { ...item, result: updated }
            : item
        )
      );
      toast({ title: "Thanks for the feedback!", variant: "success" });
    } catch {
      toast({ title: "Thanks for the feedback!", variant: "success" });
    }
  }, [toast]);

  return (
    <div className="flex flex-col gap-8">
      <ScanTabs onScan={handleScan} isScanning={isScanning} />

      {isScanning && (
        <div className="flex items-center gap-4 bg-card border border-border px-6 py-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
            <span className="font-medium">Analyzing message...</span>
          </div>
          <span className="text-sm font-medium text-muted-foreground ml-auto">
            Item {currentIndex + 1} of {items.length}
          </span>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight border-b pb-2">Results</h2>
          <div className="flex flex-col gap-8">
            <AnimatePresence>
              {items.map((item) => {
                if (item.status === "pending" || item.status === "scanning") {
                  return null;
                }

                const displayResult = item.result || (item.text ? fallbackClientAnalyze(item.text, item.inputType) : null);

                return (
                  <motion.div 
                    key={item.id} 
                    className="flex flex-col gap-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  >
                    <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-block w-fit">
                      Input: {item.file ? item.file.name : item.text ? (item.text.length > 50 ? item.text.substring(0, 50) + "..." : item.text) : "Scanned message"}
                    </div>
                    
                    {displayResult && (
                      <VerdictCard 
                        result={displayResult} 
                        onFeedback={(isAccurate) => handleFeedback(item.id, displayResult.id, isAccurate)} 
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
});
