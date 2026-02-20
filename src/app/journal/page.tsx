"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AIAnalysis {
  h4Bias?: string;
  h4Analysis?: string;
  h1Exhaustion?: boolean;
  h1Analysis?: string;
  h1LiqSweep?: {
    detected?: boolean;
    level?: string;
    description?: string;
  };
  h1BoS?: {
    detected?: boolean;
    level?: string;
    description?: string;
  };
  m15Confluence?: {
    fvg?: boolean;
    orderBlock?: boolean;
    orderBlockType?: string;
    ema20?: boolean;
    sr?: boolean;
    zone?: string;
    description?: string;
  };
  m5Timing?: string;
  m5Analysis?: string;
  setupGrade?: string;
  confidence?: number;
  smcSequence?: {
    h4Trend?: boolean;
    liqSweep?: boolean;
    bos?: boolean;
    entryZone?: boolean;
    timing?: boolean;
    summary?: string;
  };
  traderAssessment?: {
    shouldTrade?: boolean;
    emotionalRisk?: string;
    concerns?: string[];
    recommendation?: string;
  };
  entryPlan?: {
    direction?: string;
    entryZone?: string;
    stopLoss?: string;
    takeProfit?: string;
    slPips?: number;
    rrRatio?: string;
    lotSize?: number;
    riskAmount?: string;
  };
  keyLevels?: { type: string; level: string; note: string }[];
  notes?: string[];
  overallVerdict?: string;
}

interface Trade {
  _id: string;
  pair: string;
  direction: string;
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  lotSize: number;
  riskAmount: number;
  rrRatio: string;
  aiConfidence: number;
  setupGrade: string;
  screenshot: string;
  aiAnalysis: AIAnalysis;
  preTradeNotes: string;
  postTradeNotes: string;
  outcome: string;
  pnlAmount: number;
  createdAt: string;
  closedAt: string | null;
}

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [closeOutcome, setCloseOutcome] = useState<string>("");
  const [closePnl, setClosePnl] = useState("");
  const [postNotes, setPostNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/check");
      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push("/login");
        return;
      }
      fetchTrades();
    };
    init();
  }, [router]);

  const fetchTrades = async () => {
    try {
      const res = await fetch("/api/trades?limit=100");
      if (res.ok) {
        const data = await res.json();
        setTrades(data);
      }
    } catch {
      // Empty state
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTrade = async () => {
    if (!selectedTrade || !closeOutcome) return;
    setClosing(true);

    try {
      const res = await fetch(`/api/trades/${selectedTrade._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: closeOutcome,
          pnlAmount: parseFloat(closePnl) || 0,
          postTradeNotes: postNotes,
        }),
      });

      if (res.ok) {
        toast.success("Trade closed");
        setSelectedTrade(null);
        setCloseOutcome("");
        setClosePnl("");
        setPostNotes("");
        fetchTrades();
      } else {
        toast.error("Failed to close trade");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setClosing(false);
    }
  };

  const getAnalysisSummary = (ai: AIAnalysis): string => {
    if (!ai) return "";
    const parts: string[] = [];
    if (ai.h4Bias) parts.push(`H4: ${ai.h4Bias}`);
    if (ai.h1Analysis) parts.push(ai.h1Analysis);
    if (ai.traderAssessment?.recommendation) parts.push(ai.traderAssessment.recommendation);
    return parts.join(" | ").slice(0, 200);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black tracking-tight mb-8">Trade Journal</h1>

        {trades.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground mb-4">No trades recorded yet.</p>
            <Button
              onClick={() => router.push("/analyze")}
              className="bg-primary text-primary-foreground font-bold"
            >
              Start Your First Analysis
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map((trade) => {
              const isExpanded = expandedTrade === trade._id;
              const ai = trade.aiAnalysis;

              return (
                <div
                  key={trade._id}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  {/* Main row - always visible */}
                  <div className="flex items-stretch">
                    {/* Screenshot thumbnail */}
                    {trade.screenshot ? (
                      <div
                        onClick={() => setImageModal(trade.screenshot)}
                        className="w-24 min-h-[80px] shrink-0 cursor-pointer relative group overflow-hidden bg-secondary"
                      >
                        <img
                          src={trade.screenshot}
                          alt={`${trade.pair} chart`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 text-lg transition-opacity">&#128269;</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-24 min-h-[80px] shrink-0 bg-secondary flex items-center justify-center">
                        <span className="text-muted-foreground/30 text-2xl">&#128202;</span>
                      </div>
                    )}

                    {/* Trade info */}
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={
                              trade.direction === "SELL"
                                ? "text-red-500 border-red-500/30"
                                : "text-green-500 border-green-500/30"
                            }
                          >
                            {trade.direction}
                          </Badge>
                          <span className="font-bold text-sm">{trade.pair}</span>
                          <Badge
                            variant="outline"
                            className="text-primary border-primary/30"
                          >
                            {trade.setupGrade}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {trade.aiConfidence}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              trade.outcome === "win"
                                ? "text-green-500 border-green-500/30 bg-green-500/10"
                                : trade.outcome === "loss"
                                ? "text-red-500 border-red-500/30 bg-red-500/10"
                                : trade.outcome === "breakeven"
                                ? "text-yellow-500 border-yellow-500/30 bg-yellow-500/10"
                                : trade.outcome === "skipped"
                                ? "text-purple-500 border-purple-500/30 bg-purple-500/10"
                                : "text-blue-500 border-blue-500/30 bg-blue-500/10"
                            }
                          >
                            {trade.outcome.toUpperCase()}
                          </Badge>
                          {trade.outcome !== "open" && trade.outcome !== "skipped" && (
                            <span
                              className={`font-bold font-mono text-sm ${
                                trade.pnlAmount >= 0 ? "text-green-500" : "text-red-500"
                              }`}
                            >
                              {trade.pnlAmount >= 0 ? "+" : ""}${trade.pnlAmount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* AI summary preview (first few lines) */}
                      {ai && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {getAnalysisSummary(ai)}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground/60">
                          {new Date(trade.createdAt).toLocaleString()}
                          {trade.outcome === "open" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrade(trade);
                              }}
                              className="ml-2 text-primary hover:underline"
                            >
                              Close trade
                            </button>
                          )}
                        </p>

                        {/* Expand/collapse toggle */}
                        <button
                          onClick={() => setExpandedTrade(isExpanded ? null : trade._id)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                        >
                          {isExpanded ? "Hide Report" : "View Report"}
                          <span
                            className={`inline-block transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          >
                            &#9660;
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded AI analysis */}
                  {isExpanded && ai && (
                    <div className="border-t border-border px-5 py-4 bg-secondary/30 animate-fade-up">
                      {/* Verdict banner */}
                      {ai.overallVerdict && (
                        <div className="flex items-center gap-2 mb-4">
                          <Badge
                            variant="outline"
                            className={`text-sm font-bold px-3 py-1 ${
                              ai.overallVerdict === "ENTER"
                                ? "border-green-500/30 text-green-500 bg-green-500/10"
                                : ai.overallVerdict === "BLOCKED"
                                ? "border-red-500/30 text-red-500 bg-red-500/10"
                                : "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                            }`}
                          >
                            {ai.overallVerdict}
                          </Badge>
                          {ai.confidence !== undefined && (
                            <span className="text-sm font-bold text-primary">{ai.confidence}% confidence</span>
                          )}
                        </div>
                      )}

                      {/* Trader Assessment */}
                      {ai.traderAssessment && (
                        <div
                          className={`rounded-lg p-4 mb-4 border ${
                            ai.traderAssessment.shouldTrade
                              ? "bg-green-500/5 border-green-500/20"
                              : "bg-red-500/5 border-red-500/20"
                          }`}
                        >
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            Trader Assessment
                          </h4>
                          <p className="text-xs mb-2">
                            <span className="text-muted-foreground">Emotional Risk: </span>
                            <span className={`font-bold ${
                              ai.traderAssessment.emotionalRisk === "HIGH"
                                ? "text-red-500"
                                : ai.traderAssessment.emotionalRisk === "MEDIUM"
                                ? "text-yellow-500"
                                : "text-green-500"
                            }`}>
                              {ai.traderAssessment.emotionalRisk}
                            </span>
                          </p>
                          <p className="text-xs text-foreground/70 leading-relaxed">
                            {ai.traderAssessment.recommendation}
                          </p>
                          {ai.traderAssessment.concerns && ai.traderAssessment.concerns.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {ai.traderAssessment.concerns.map((c, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="text-yellow-500">&#9888;</span>
                                  <span>{c}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SMC Sequence */}
                      {ai.smcSequence && (
                        <div className="bg-background/50 rounded-lg p-3 border border-border mb-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                            SMC Sequence
                          </h4>
                          <div className="flex gap-1.5 flex-wrap mb-2">
                            {[
                              { key: "h4Trend", label: "H4 Trend" },
                              { key: "liqSweep", label: "Liq Sweep" },
                              { key: "bos", label: "BoS" },
                              { key: "entryZone", label: "Entry Zone" },
                              { key: "timing", label: "M5 Timing" },
                            ].map(({ key, label }) => (
                              <Badge key={key} variant="outline" className={`text-[10px] ${
                                ai.smcSequence?.[key as keyof typeof ai.smcSequence]
                                  ? "text-green-500 border-green-500/30"
                                  : "text-red-500 border-red-500/30"
                              }`}>
                                {ai.smcSequence?.[key as keyof typeof ai.smcSequence] ? "\u2713" : "\u2717"} {label}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-[10px] text-foreground/60">{ai.smcSequence.summary}</p>
                        </div>
                      )}

                      {/* Timeframe breakdown */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {ai.h4Analysis && (
                          <div className="bg-background/50 rounded-lg p-3 border border-border">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              H4 — {ai.h4Bias}
                            </h4>
                            <p className="text-xs text-foreground/70">{ai.h4Analysis}</p>
                          </div>
                        )}
                        {ai.h1Analysis && (
                          <div className="bg-background/50 rounded-lg p-3 border border-border">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              H1 Exhaustion & Sweep
                            </h4>
                            <p className="text-xs text-foreground/70 mb-1.5">{ai.h1Analysis}</p>
                            {ai.h1LiqSweep && (
                              <div className="flex items-start gap-1 text-[10px] mb-1">
                                <Badge variant="outline" className={`text-[10px] shrink-0 ${ai.h1LiqSweep.detected ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                                  Sweep {ai.h1LiqSweep.detected ? "\u2713" : "\u2717"}
                                </Badge>
                                <span className="text-foreground/50">{ai.h1LiqSweep.description}</span>
                              </div>
                            )}
                            {ai.h1BoS && (
                              <div className="flex items-start gap-1 text-[10px]">
                                <Badge variant="outline" className={`text-[10px] shrink-0 ${ai.h1BoS.detected ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                                  BoS {ai.h1BoS.detected ? "\u2713" : "\u2717"}
                                </Badge>
                                <span className="text-foreground/50">{ai.h1BoS.description}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {ai.m15Confluence && (
                          <div className="bg-background/50 rounded-lg p-3 border border-border">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              M15 Confluence
                            </h4>
                            <p className="text-xs text-foreground/70 mb-1">{ai.m15Confluence.description}</p>
                            {ai.m15Confluence.zone && (
                              <p className="text-[10px] font-mono text-primary font-bold mb-1.5">Zone: {ai.m15Confluence.zone}</p>
                            )}
                            <div className="flex gap-1 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] ${ai.m15Confluence.fvg ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                                FVG {ai.m15Confluence.fvg ? "\u2713" : "\u2717"}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${ai.m15Confluence.orderBlock ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                                {ai.m15Confluence.orderBlockType && ai.m15Confluence.orderBlockType !== "none"
                                  ? `${ai.m15Confluence.orderBlockType === "internal" ? "Int OB" : ai.m15Confluence.orderBlockType === "breaker" ? "Breaker" : "OB"}`
                                  : "OB"}{" "}
                                {ai.m15Confluence.orderBlock ? "\u2713" : "\u2717"}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${ai.m15Confluence.ema20 ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                                20EMA {ai.m15Confluence.ema20 ? "\u2713" : "\u2717"}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${ai.m15Confluence.sr ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                                S/R {ai.m15Confluence.sr ? "\u2713" : "\u2717"}
                              </Badge>
                            </div>
                          </div>
                        )}
                        {ai.m5Analysis && (
                          <div className="bg-background/50 rounded-lg p-3 border border-border">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              M5 Timing
                            </h4>
                            <Badge variant="outline" className={`text-[10px] mb-1.5 ${
                              ai.m5Timing === "READY" ? "text-green-500 border-green-500/30"
                              : ai.m5Timing === "WAIT" ? "text-yellow-500 border-yellow-500/30"
                              : ai.m5Timing === "MISSED" ? "text-red-500 border-red-500/30"
                              : "text-muted-foreground border-border"
                            }`}>
                              {ai.m5Timing}
                            </Badge>
                            <p className="text-xs text-foreground/70">{ai.m5Analysis}</p>
                          </div>
                        )}
                      </div>

                      {/* Chart Analysis Notes */}
                      {ai.notes && ai.notes.length > 0 && (
                        <div className="bg-background/50 rounded-lg p-3 border border-border mb-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                            Chart Analysis Notes
                          </h4>
                          <div className="space-y-1">
                            {ai.notes.map((note, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
                                <span className="text-primary mt-0.5">&#9656;</span>
                                <span>{note}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Key Levels */}
                      {ai.keyLevels && ai.keyLevels.length > 0 && (
                        <div className="bg-background/50 rounded-lg p-3 border border-border mb-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                            Key Levels
                          </h4>
                          {ai.keyLevels.map((level, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">{level.type}</span>
                                <p className="text-[10px] text-foreground/50">{level.note}</p>
                              </div>
                              <span className="text-xs font-bold text-primary font-mono">{level.level}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Entry Plan (only for non-skip trades) */}
                      {trade.outcome !== "skipped" && ai.entryPlan && ai.entryPlan.entryZone !== "N/A" && (
                        <div className="bg-primary/5 rounded-lg p-3 border border-primary/20 mb-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                            Trade Plan
                          </h4>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <span className="text-[10px] text-muted-foreground">Direction</span>
                              <p className={`text-xs font-bold ${ai.entryPlan.direction === "SELL" ? "text-red-500" : "text-green-500"}`}>
                                {ai.entryPlan.direction}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground">Entry</span>
                              <p className="text-xs font-bold font-mono">{ai.entryPlan.entryZone}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground">SL</span>
                              <p className="text-xs font-bold font-mono text-red-500">{ai.entryPlan.stopLoss}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground">TP</span>
                              <p className="text-xs font-bold font-mono text-green-500">{ai.entryPlan.takeProfit}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground">R:R</span>
                              <p className="text-xs font-bold font-mono">{ai.entryPlan.rrRatio}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground">Lot Size</span>
                              <p className="text-xs font-bold font-mono">{ai.entryPlan.lotSize}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground">Risk</span>
                              <p className="text-xs font-bold font-mono">{ai.entryPlan.riskAmount}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground">SL Pips</span>
                              <p className="text-xs font-bold font-mono">{ai.entryPlan.slPips}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pre/Post trade notes */}
                      {trade.preTradeNotes && (
                        <div className="bg-background/50 rounded-lg p-3 border border-border mb-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            {trade.outcome === "skipped" ? "Skip Notes" : "Pre-Trade Notes"}
                          </h4>
                          <p className="text-xs text-foreground/70 italic">&quot;{trade.preTradeNotes}&quot;</p>
                        </div>
                      )}
                      {trade.postTradeNotes && (
                        <div className="bg-background/50 rounded-lg p-3 border border-border">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Post-Trade Notes
                          </h4>
                          <p className="text-xs text-foreground/70 italic">&quot;{trade.postTradeNotes}&quot;</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Close Trade Dialog */}
        <Dialog
          open={!!selectedTrade}
          onOpenChange={(open) => !open && setSelectedTrade(null)}
        >
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Close Trade: {selectedTrade?.pair} {selectedTrade?.direction}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                  Outcome
                </label>
                <div className="flex gap-2">
                  {["win", "loss", "breakeven"].map((o) => (
                    <button
                      key={o}
                      onClick={() => setCloseOutcome(o)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase transition-all ${
                        closeOutcome === o
                          ? o === "win"
                            ? "bg-green-500/15 border-2 border-green-500 text-green-500"
                            : o === "loss"
                            ? "bg-red-500/15 border-2 border-red-500 text-red-500"
                            : "bg-yellow-500/15 border-2 border-yellow-500 text-yellow-500"
                          : "bg-secondary border-2 border-border text-muted-foreground"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  P&L Amount ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={closePnl}
                  onChange={(e) => setClosePnl(e.target.value)}
                  placeholder="e.g. 25.00 or -12.50"
                  className="bg-secondary border-border"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Post-Trade Notes
                </label>
                <Textarea
                  value={postNotes}
                  onChange={(e) => setPostNotes(e.target.value)}
                  placeholder="What happened? What did I learn?"
                  className="bg-secondary border-border min-h-[80px]"
                />
              </div>

              <Button
                onClick={handleCloseTrade}
                disabled={!closeOutcome || closing}
                className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90"
              >
                {closing ? "Closing..." : "Close Trade"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Full Screenshot Modal */}
        <Dialog
          open={!!imageModal}
          onOpenChange={(open) => !open && setImageModal(null)}
        >
          <DialogContent className="bg-card border-border max-w-[90vw] max-h-[90vh] p-2">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Chart Screenshot</DialogTitle>
            </DialogHeader>
            {imageModal && (
              <img
                src={imageModal}
                alt="Full chart screenshot"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
