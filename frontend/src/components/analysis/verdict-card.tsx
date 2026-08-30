"use client";

import { ShieldAlert, ShieldCheck, ThumbsDown, ThumbsUp, Printer, Sparkles, Activity, FileSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/analysis/risk-badge";
import { TokenChip } from "@/components/analysis/token-chip";
import { ScanSummary } from "@/components/analysis/scan-summary";
import { ConfidenceGauge } from "@/components/analysis/confidence-gauge";
import { AIExplanation } from "@/components/analysis/ai-explanation";
import { RiskBreakdown } from "@/components/analysis/risk-breakdown";
import { EntityHighlights } from "@/components/analysis/entity-highlights";
import { RecommendedActions } from "@/components/analysis/recommended-actions";
import { SimilarPatterns } from "@/components/analysis/similar-patterns";
import { Button } from "@/components/ui/button";
import { formatPercent, scamCategoryLabel, verdictLabel } from "@/lib/utils";
import type { AnalysisResult } from "@/types";
import { motion, Variants } from "framer-motion";

interface VerdictCardProps {
  result: AnalysisResult;
  onFeedback?: (isAccurate: boolean) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function VerdictCard({ result, onFeedback }: VerdictCardProps) {
  const isSafe = result.verdict === "legitimate";
  const maxWeight = Math.max(0, ...result.top_contributing_tokens.map((t) => t.weight));
  const hasExplainableData = Boolean(
    result.ai_explanation || 
    result.executive_summary || 
    result.technical_explanation || 
    result.risk_breakdown || 
    result.threat_level
  );

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6"
    >
      {/* Scan Summary Banner */}
      <motion.div variants={itemVariants}>
        <ScanSummary result={result} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border border-border bg-card shadow-sm">
          <div
            className={
              isSafe
                ? "h-1 w-full bg-green-500"
                : result.threat_level === "critical"
                  ? "h-1 w-full bg-red-600"
                  : result.risk_level === "high"
                    ? "h-1 w-full bg-orange-500"
                    : "h-1 w-full bg-yellow-500"
            }
          />

          <CardContent className="flex flex-col gap-8 p-8">

            {/* Header: Verdict + Confidence Gauge + Print */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between z-10">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${isSafe ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'} ring-1 ring-inset ${isSafe ? 'ring-green-500/20' : 'ring-red-500/20'}`}>
                  {isSafe ? (
                    <ShieldCheck className="h-10 w-10" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="h-10 w-10" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <h3 className="text-3xl font-bold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">{verdictLabel(result.verdict)}</h3>
                  <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    {formatPercent(result.scam_probability)} scam probability
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <ConfidenceGauge value={result.confidence_score} />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="print:hidden h-10 w-10 p-0 sm:w-auto sm:px-4 sm:py-2 rounded-xl backdrop-blur-md bg-background/50 hover:bg-background/80 transition-all border-white/10"
                  onClick={() => window.print()}
                  title="Export PDF"
                >
                  <Printer className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline font-medium">Export Report</span>
                </Button>
              </div>
            </div>

            {/* Metrics */}
            <motion.dl variants={itemVariants} className="grid grid-cols-2 gap-4 sm:grid-cols-4 z-10">
              <Metric label="Category" value={scamCategoryLabel(result.scam_category)} icon={FileSearch} />
              <Metric label="Confidence" value={formatPercent(result.confidence_score)} icon={Sparkles} />
              <Metric label="Threat score" value={formatPercent(result.threat_score)} icon={ShieldAlert} />
              <Metric label="Response time" value={`${result.latency_ms.toFixed(1)} ms`} icon={Activity} />
            </motion.dl>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50 z-10" />

            {/* AI Explanation */}
            <motion.div variants={itemVariants} className="z-10">
              <AIExplanation 
                explanation={result.ai_explanation} 
                executiveSummary={result.executive_summary}
                technicalExplanation={result.technical_explanation}
              />
            </motion.div>

            {/* Risk Breakdown */}
            {hasExplainableData && (
              <motion.div variants={itemVariants} className="z-10">
                <RiskBreakdown breakdown={result.risk_breakdown} />
              </motion.div>
            )}

            {/* Entity Highlights */}
            <motion.div variants={itemVariants} className="z-10">
              <EntityHighlights entities={result.highlighted_entities} />
            </motion.div>

            {/* Suspicious Keywords */}
            {result.top_contributing_tokens.length > 0 && (
              <motion.div variants={itemVariants} className="rounded-xl bg-muted/30 p-5 border border-border/50 shadow-sm z-10">
                <p className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Suspicious Keywords Detected
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.top_contributing_tokens.map((contribution) => (
                    <TokenChip key={contribution.token} contribution={contribution} maxWeight={maxWeight} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Recommended Actions */}
            <motion.div variants={itemVariants} className="z-10">
              <RecommendedActions actions={result.recommended_actions} />
            </motion.div>

            {/* Similar Patterns */}
            <motion.div variants={itemVariants} className="z-10">
              <SimilarPatterns patterns={result.similar_patterns} />
            </motion.div>

            {/* Model info + Feedback */}
            <motion.div variants={itemVariants} className="flex items-center justify-between pt-6 border-t border-border/50 z-10">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Scored by {result.model_name} (v{result.model_version})
              </p>

              {onFeedback && (
                <div className="flex items-center gap-3 print:hidden bg-muted/30 p-1.5 rounded-full border border-border/50">
                  <span className="text-xs font-medium text-muted-foreground px-2">Was this accurate?</span>
                  <Button
                    variant={result.user_feedback === true ? "primary" : "ghost"}
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-green-500/20 hover:text-green-500 transition-colors"
                    onClick={() => onFeedback(true)}
                    aria-label="Mark as accurate"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={result.user_feedback === false ? "destructive" : "ghost"}
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-colors"
                    onClick={() => onFeedback(false)}
                    aria-label="Mark as inaccurate"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Realistic Safety Disclaimer */}
            <div className="pt-2 text-center">
              <p className="text-xs text-muted-foreground/80 italic">
                Notice: ScamGuard provides an automated heuristic and statistical risk assessment. It should not be treated as an absolute guarantee of safety. Always verify sensitive communications via independent official channels.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-muted/30 border border-border/50 shadow-sm">
      <dt className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </dt>
      <dd className="text-lg font-bold text-foreground">{value}</dd>
    </div>
  );
}
