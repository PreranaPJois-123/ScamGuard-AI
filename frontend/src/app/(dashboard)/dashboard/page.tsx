"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ScanSearch, ShieldCheck, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { getHistory } from "@/lib/api/messages";
import { useAuth } from "@/lib/auth/auth-context";
import { StatCard } from "@/components/analytics/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RiskBadge } from "@/components/analysis/risk-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { formatDate, formatPercent, truncate, verdictLabel } from "@/lib/utils";
import type { AnalysisResult } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHistory()
      .then(setEntries)
      .catch(() => setError("Could not load your activity. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  const totalScanned = entries.length;
  const flagged = entries.filter((e) => e.verdict !== "legitimate").length;
  const highRisk = entries.filter((e) => e.risk_level === "high").length;
  const avgConfidence =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + e.confidence_score, 0) / entries.length
      : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{user ? `, ${user.full_name || user.email.split("@")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s an overview of your scam-detection activity.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <motion.div 
          initial="hidden" 
          animate="show" 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
            <StatCard label="Messages analyzed" value={String(totalScanned)} icon={ScanSearch} />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
            <StatCard label="Flagged as suspicious" value={String(flagged)} icon={AlertTriangle} accent="warning" />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
            <StatCard label="High risk" value={String(highRisk)} icon={ShieldCheck} accent="destructive" />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
            <StatCard
              label="Avg. model confidence"
              value={totalScanned > 0 ? formatPercent(avgConfidence) : "—"}
              icon={TrendingUp}
              accent="success"
            />
          </motion.div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Card className="glass-panel">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent activity</CardTitle>
          <Link href="/analyze" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Analyze a message
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={ScanSearch}
              title="No activity yet"
              description="Analyze your first message to see results here."
              actionHref="/analyze"
              actionLabel="Analyze a message"
            />
          ) : (
            <ul className="divide-y divide-border">
              {entries.slice(0, 5).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{truncate(entry.text, 70)}</p>
                    <p className="text-xs text-muted-foreground">
                      {verdictLabel(entry.verdict)} · {formatDate(entry.created_at)}
                    </p>
                  </div>
                  <RiskBadge level={entry.risk_level} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
