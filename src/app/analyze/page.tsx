"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Phase = "upload" | "analyzing" | "verdict" | "checklist" | "journal";

interface MT5Data {
  account?: {
    balance: number;
    equity: number;
    profit: number;
    marginFree: number;
    leverage: number;
    server: string;
    name: string;
  };
  positions?: Array<{
    symbol: string;
    type: string;
    volume: number;
    openPrice: number;
    currentPrice: number;
    profit: number;
  }>;
  todayHistory?: Array<{
    symbol: string;
    type: string;
    profit: number;
  }>;
  symbols?: Record<string, { bid: number; ask: number; spread: number }>;
  screenshot?: string;
  capturedAt?: string;
  empty?: boolean;
}

interface AnalysisResult {
  h4Bias: string;
  h4Analysis: string;
  h1Exhaustion: boolean;
  h1Analysis: string;
  m15Confluence: {
    fvg: boolean;
    ema20: boolean;
    sr: boolean;
    description: string;
  };
  m5Timing: string;
  m5Analysis: string;
  setupGrade: string;
  confidence: number;
  traderAssessment: {
    shouldTrade: boolean;
    emotionalRisk: string;
    concerns: string[];
    recommendation: string;
  };
  entryPlan: {
    direction: string;
    entryZone: string;
    stopLoss: string;
    takeProfit: string;
    slPips: number;
    rrRatio: string;
    lotSize: number;
    riskAmount: string;
  };
  keyLevels: { type: string; level: string; note: string }[];
  notes: string[];
  overallVerdict: string;
}

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD"];

const RULES = [
  "I see exhaustion on smaller TF against bigger TF trend",
  "FVG + 20 EMA + S/R confluence is present",
  "Risk:Reward is minimum 1:2",
  "This is within my max trades per day",
  "I have NOT hit my daily loss limit",
  "No high-impact news in next 30 minutes",
  "I accept the AI's analysis and entry plan",
];

const PHASE_STEPS = [
  { key: "upload", label: "Upload" },
  { key: "analyzing", label: "Analysis" },
  { key: "verdict", label: "Verdict" },
  { key: "checklist", label: "Checklist" },
  { key: "journal", label: "Journal" },
];

export default function AnalyzePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("upload");
  const [pair, setPair] = useState("EURUSD");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [checklist, setChecklist] = useState(RULES.map(() => false));
  const [preTradeNotes, setPreTradeNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [skipJournal, setSkipJournal] = useState(false);
  const [skipNotes, setSkipNotes] = useState("");
  const [mt5Data, setMt5Data] = useState<MT5Data | null>(null);
  const [mt5Polling, setMt5Polling] = useState(false);

  const currentIdx = PHASE_STEPS.findIndex((p) => p.key === phase);

  // Poll for MT5 data
  const fetchMT5Data = useCallback(async () => {
    try {
      const res = await fetch("/api/mt5");
      if (res.ok) {
        const data = await res.json();
        if (!data.empty) {
          setMt5Data(data);
          // If there's a new screenshot from MT5, load it
          if (data.screenshot && data.screenshot !== screenshot) {
            setScreenshot(data.screenshot);
            setScreenshotPreview(data.screenshot);
            toast.success("MT5 screenshot captured!");
          }
        }
      }
    } catch {
      // Silent fail
    }
  }, [screenshot]);

  useEffect(() => {
    // Poll every 2 seconds when on upload phase
    if (phase === "upload" && mt5Polling) {
      const interval = setInterval(fetchMT5Data, 2000);
      return () => clearInterval(interval);
    }
  }, [phase, mt5Polling, fetchMT5Data]);

  const startMT5Polling = () => {
    setMt5Polling(true);
    fetchMT5Data();
    toast.info("Listening for MT5 bridge... Press F9 in MT5 to capture.");
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setScreenshot(result);
      setScreenshotPreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFileSelect(file);
          break;
        }
      }
    },
    [handleFileSelect]
  );

  const handleAnalyze = async () => {
    if (!screenshot) return;
    setPhase("analyzing");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair, screenshot }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setPhase("verdict");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
      setPhase("upload");
    }
  };

  const handleSaveTrade = async () => {
    if (!analysis) return;
    setSaving(true);

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair,
          direction: analysis.entryPlan.direction,
          entryPrice: parseFloat(analysis.entryPlan.entryZone.split("-")[0]) || 0,
          slPrice: parseFloat(analysis.entryPlan.stopLoss) || 0,
          tpPrice: parseFloat(analysis.entryPlan.takeProfit) || 0,
          lotSize: analysis.entryPlan.lotSize,
          riskAmount: parseFloat(analysis.entryPlan.riskAmount?.replace("$", "")) || 0,
          rrRatio: analysis.entryPlan.rrRatio,
          aiConfidence: analysis.confidence,
          setupGrade: analysis.setupGrade,
          screenshot: screenshot,
          aiAnalysis: analysis,
          preTradeNotes,
          checklistCompleted: true,
          outcome: "open",
        }),
      });

      if (!res.ok) throw new Error("Failed to save trade");

      toast.success("Trade logged successfully");
      setTimeout(() => router.push("/"), 1500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSkip = async () => {
    if (!analysis) return;
    setSaving(true);

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair,
          direction: analysis.entryPlan?.direction || "BUY",
          aiConfidence: analysis.confidence,
          setupGrade: analysis.setupGrade,
          screenshot: screenshot,
          aiAnalysis: analysis,
          preTradeNotes: skipNotes || `Skipped: ${analysis.traderAssessment?.recommendation || analysis.overallVerdict}`,
          checklistCompleted: false,
          outcome: "skipped",
          pnlAmount: 0,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Skip decision journaled - discipline logged!");
      setTimeout(() => router.push("/"), 1500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const allChecked = checklist.every(Boolean);
  const gradeColor =
    analysis?.setupGrade === "A+"
      ? "text-green-500"
      : analysis?.setupGrade === "B"
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <div className="min-h-screen" onPaste={handlePaste}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Phase Indicator */}
        <div className="flex items-center gap-0 mb-10 max-w-lg mx-auto">
          {PHASE_STEPS.map((p, i) => {
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            return (
              <div key={p.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isDone
                        ? "bg-green-500 border-2 border-green-500 text-background"
                        : isActive
                        ? "bg-primary border-2 border-primary text-primary-foreground"
                        : "bg-secondary border-2 border-border text-muted-foreground"
                    }`}
                  >
                    {isDone ? "\u2713" : i + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-[10px] font-semibold uppercase tracking-widest ${
                      isActive
                        ? "text-primary"
                        : isDone
                        ? "text-green-500"
                        : "text-muted-foreground/50"
                    }`}
                  >
                    {p.label}
                  </span>
                </div>
                {i < PHASE_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 -mb-5 ${
                      i < currentIdx ? "bg-green-500" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Main Content Card */}
        <div className="bg-card border border-border rounded-2xl p-8 animate-fade-up">
          {/* UPLOAD PHASE */}
          {phase === "upload" && (
            <div>
              <h2 className="text-xl font-bold text-primary mb-1">
                Upload MetaTrader Screenshot
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Take a screenshot of MetaTrader showing all 4 timeframes (4H, 1H,
                15M, 5M) in one split-screen view.
              </p>

              {/* MT5 Bridge Status */}
              <div className="flex gap-3 mb-6">
                <Button
                  variant="outline"
                  onClick={startMT5Polling}
                  className={`text-sm font-semibold ${
                    mt5Polling
                      ? "border-green-500/50 text-green-500 bg-green-500/10"
                      : "border-primary/30 text-primary"
                  }`}
                >
                  {mt5Polling ? "Listening for MT5..." : "Connect MT5 Bridge"}
                </Button>
                {mt5Data?.account && (
                  <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-secondary/50 border border-border text-xs">
                    <div>
                      <span className="text-muted-foreground">Balance: </span>
                      <span className="font-bold font-mono">${mt5Data.account.balance.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Equity: </span>
                      <span className="font-bold font-mono">${mt5Data.account.equity.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">P/L: </span>
                      <span className={`font-bold font-mono ${mt5Data.account.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {mt5Data.account.profit >= 0 ? "+" : ""}${mt5Data.account.profit.toFixed(2)}
                      </span>
                    </div>
                    {mt5Data.positions && mt5Data.positions.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Open: </span>
                        <span className="font-bold">{mt5Data.positions.length}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pair Selection */}
              <div className="mb-6">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                  Trading Pair
                </label>
                <div className="flex gap-2">
                  {PAIRS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPair(p)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold tracking-wider transition-all ${
                        pair === p
                          ? "bg-primary/15 border-2 border-primary text-primary"
                          : "bg-secondary border-2 border-border text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById("file-input")?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  screenshot
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />

                {screenshotPreview ? (
                  <div>
                    <img
                      src={screenshotPreview}
                      alt="Chart preview"
                      className="max-h-80 mx-auto rounded-lg border border-border mb-4"
                    />
                    <p className="text-sm text-green-500 font-semibold">
                      Screenshot loaded - Click or paste to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-5xl mb-4 opacity-30">&#128202;</div>
                    <p className="text-muted-foreground font-medium mb-2">
                      Drop screenshot here, paste from clipboard, click to browse,
                      or press F9 in MT5 Bridge
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      MetaTrader multi-timeframe view (4H + 1H + 15M + 5M in one screen)
                    </p>
                  </div>
                )}
              </div>

              {screenshot && (
                <Button
                  onClick={handleAnalyze}
                  className="w-full mt-6 bg-primary text-primary-foreground font-bold text-base py-6 hover:bg-primary/90"
                >
                  ANALYZE WITH AI
                </Button>
              )}
            </div>
          )}

          {/* ANALYZING PHASE */}
          {phase === "analyzing" && (
            <div className="text-center py-16 animate-fade-up">
              <div className="w-20 h-20 rounded-full border-3 border-primary/20 border-t-primary mx-auto mb-8 animate-spin" />
              <h2 className="text-xl font-bold text-primary mb-3">
                AI Analyzing Your Chart
              </h2>
              <p className="text-sm text-muted-foreground animate-pulse">
                Evaluating all 4 timeframes against your strategy...
              </p>
            </div>
          )}

          {/* VERDICT PHASE */}
          {phase === "verdict" && analysis && (
            <div className="animate-fade-up">
              {/* Top Row: Bias + Grade + Confidence */}
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-sm font-bold px-4 py-1.5 ${
                    analysis.h4Bias === "BEARISH"
                      ? "border-red-500/30 text-red-500 bg-red-500/10"
                      : analysis.h4Bias === "BULLISH"
                      ? "border-green-500/30 text-green-500 bg-green-500/10"
                      : "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                  }`}
                >
                  {analysis.h4Bias}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-sm font-bold px-4 py-1.5 ${gradeColor} border-current/30 bg-current/10`}
                >
                  {analysis.setupGrade} SETUP
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-sm font-bold px-4 py-1.5 ${
                    analysis.overallVerdict === "ENTER"
                      ? "border-green-500/30 text-green-500 bg-green-500/10"
                      : analysis.overallVerdict === "BLOCKED"
                      ? "border-red-500/30 text-red-500 bg-red-500/10"
                      : "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                  }`}
                >
                  {analysis.overallVerdict}
                </Badge>
                <div className="ml-auto text-right">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Confidence
                  </span>
                  <span className="text-2xl font-black text-primary">
                    {analysis.confidence}%
                  </span>
                </div>
              </div>

              {/* Trader Assessment (AI's emotional evaluation) */}
              <div
                className={`rounded-xl p-5 mb-5 border ${
                  analysis.traderAssessment.shouldTrade
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-red-500/5 border-red-500/20"
                }`}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Trader Assessment
                </h3>
                <p
                  className={`text-sm font-semibold mb-3 ${
                    analysis.traderAssessment.shouldTrade
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  Emotional Risk:{" "}
                  <span className="font-black">
                    {analysis.traderAssessment.emotionalRisk}
                  </span>
                </p>
                <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
                  {analysis.traderAssessment.recommendation}
                </p>
                {analysis.traderAssessment.concerns.length > 0 && (
                  <div className="space-y-1.5">
                    {analysis.traderAssessment.concerns.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="text-yellow-500 mt-0.5">&#9888;</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Analysis Notes */}
              <div className="bg-secondary/50 rounded-xl p-5 border border-border mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
                  Chart Analysis
                </h3>
                <div className="space-y-2">
                  {analysis.notes.map((note, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-sm text-foreground/70"
                    >
                      <span className="text-primary mt-0.5">&#9656;</span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeframe Breakdown */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-secondary/50 rounded-xl p-4 border border-border">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    H4 Bias
                  </h4>
                  <p className="text-sm text-foreground/80">{analysis.h4Analysis}</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 border border-border">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    H1 Exhaustion
                  </h4>
                  <p className="text-sm text-foreground/80">{analysis.h1Analysis}</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 border border-border">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    M15 Confluence
                  </h4>
                  <p className="text-sm text-foreground/80">
                    {analysis.m15Confluence.description}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className={
                        analysis.m15Confluence.fvg
                          ? "text-green-500 border-green-500/30"
                          : "text-red-500 border-red-500/30"
                      }
                    >
                      FVG {analysis.m15Confluence.fvg ? "\u2713" : "\u2717"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        analysis.m15Confluence.ema20
                          ? "text-green-500 border-green-500/30"
                          : "text-red-500 border-red-500/30"
                      }
                    >
                      20EMA {analysis.m15Confluence.ema20 ? "\u2713" : "\u2717"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        analysis.m15Confluence.sr
                          ? "text-green-500 border-green-500/30"
                          : "text-red-500 border-red-500/30"
                      }
                    >
                      S/R {analysis.m15Confluence.sr ? "\u2713" : "\u2717"}
                    </Badge>
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 border border-border">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    M5 Timing
                  </h4>
                  <p className="text-sm text-foreground/80">{analysis.m5Analysis}</p>
                </div>
              </div>

              {/* Key Levels */}
              <div className="bg-secondary/50 rounded-xl p-5 border border-border mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
                  Key Levels
                </h3>
                {analysis.keyLevels.map((level, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {level.type}
                      </span>
                      <p className="text-xs text-foreground/60 mt-0.5">
                        {level.note}
                      </p>
                    </div>
                    <span className="text-base font-bold text-primary font-mono">
                      {level.level}
                    </span>
                  </div>
                ))}
              </div>

              {/* Entry Plan - only show when there's a valid setup */}
              {analysis.overallVerdict !== "BLOCKED" &&
                analysis.overallVerdict !== "SKIP" && (
                <div className="bg-primary/5 rounded-xl p-5 border border-primary/20 mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-4">
                    Trade Plan
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(analysis.entryPlan).map(([key, val]) => (
                      <div key={key} className="bg-background/50 rounded-lg p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </div>
                        <div
                          className={`text-sm font-bold font-mono ${
                            key === "direction"
                              ? val === "SELL"
                                ? "text-red-500"
                                : "text-green-500"
                              : "text-foreground/80"
                          }`}
                        >
                          {String(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.overallVerdict !== "BLOCKED" &&
                analysis.overallVerdict !== "SKIP" && (
                  <Button
                    onClick={() => setPhase("checklist")}
                    className="w-full bg-primary text-primary-foreground font-bold text-base py-6 hover:bg-primary/90"
                  >
                    PROCEED TO CHECKLIST
                  </Button>
                )}

              {(analysis.overallVerdict === "BLOCKED" ||
                analysis.overallVerdict === "SKIP") && (
                <div className="space-y-3">
                  <div className="rounded-xl p-4 bg-red-500/5 border border-red-500/20 text-center">
                    <p className="text-sm font-bold text-red-500 mb-1">
                      {analysis.overallVerdict === "BLOCKED"
                        ? "TRADING BLOCKED"
                        : "SETUP NOT VALID"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {analysis.overallVerdict === "BLOCKED"
                        ? "You've hit your limits. Come back tomorrow."
                        : "This doesn't match your strategy. Wait for a valid setup."}
                    </p>
                  </div>

                  {!skipJournal ? (
                    <div className="flex gap-3">
                      <Button
                        onClick={() => setSkipJournal(true)}
                        variant="outline"
                        className="flex-1 border-primary/30 text-primary font-bold py-6"
                      >
                        Journal This Decision
                      </Button>
                      <Button
                        onClick={() => router.push("/")}
                        variant="outline"
                        className="flex-1 border-border text-muted-foreground font-bold py-6"
                      >
                        Back to Dashboard
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-fade-up">
                      <Textarea
                        value={skipNotes}
                        onChange={(e) => setSkipNotes(e.target.value)}
                        placeholder="What tempted me? What did I learn from this skip? How do I feel about not trading?"
                        className="bg-secondary border-border min-h-[100px] text-sm"
                      />
                      <Button
                        onClick={handleSaveSkip}
                        disabled={saving}
                        className="w-full bg-primary text-primary-foreground font-bold py-6 hover:bg-primary/90"
                      >
                        {saving ? "Saving..." : "Save Skip to Journal"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CHECKLIST PHASE */}
          {phase === "checklist" && (
            <div className="animate-fade-up">
              <h2 className="text-xl font-bold text-primary mb-1">
                Pre-Trade Checklist
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Confirm every rule before executing. No shortcuts.
              </p>

              <div className="space-y-1 mb-8">
                {RULES.map((rule, i) => (
                  <label
                    key={i}
                    onClick={() =>
                      setChecklist((prev) =>
                        prev.map((v, idx) => (idx === i ? !v : v))
                      )
                    }
                    className="flex items-center gap-3 py-3 px-4 rounded-lg cursor-pointer hover:bg-secondary transition-colors border-b border-border last:border-0"
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs transition-all shrink-0 ${
                        checklist[i]
                          ? "bg-green-500/20 border-2 border-green-500 text-green-500"
                          : "border-2 border-border"
                      }`}
                    >
                      {checklist[i] ? "\u2713" : ""}
                    </div>
                    <span
                      className={`text-sm ${
                        checklist[i]
                          ? "text-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {rule}
                    </span>
                  </label>
                ))}
              </div>

              <Button
                onClick={() => setPhase("journal")}
                disabled={!allChecked}
                className="w-full bg-green-600 text-white font-bold text-base py-6 hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {allChecked
                  ? "ALL RULES CONFIRMED - Proceed to Journal"
                  : "Complete all checklist items to proceed"}
              </Button>
            </div>
          )}

          {/* JOURNAL PHASE */}
          {phase === "journal" && (
            <div className="animate-fade-up">
              <h2 className="text-xl font-bold text-green-500 mb-1">
                Trade Approved
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Write a quick note about why you are taking this trade and how you
                feel about it.
              </p>

              <Textarea
                value={preTradeNotes}
                onChange={(e) => setPreTradeNotes(e.target.value)}
                placeholder="I'm taking this trade because... I feel..."
                className="bg-secondary border-border min-h-[120px] text-sm mb-6"
              />

              <Button
                onClick={handleSaveTrade}
                disabled={saving}
                className="w-full bg-primary text-primary-foreground font-bold text-base py-6 hover:bg-primary/90"
              >
                {saving ? "Saving..." : "SAVE TRADE & GO TO DASHBOARD"}
              </Button>

              <p className="text-center text-xs text-muted-foreground mt-4 italic">
                &quot;Now set your alerts, walk away, and let the trade work. Do NOT move your stop loss.&quot;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
