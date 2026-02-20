"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Stats {
  today: { tradesCount: number; losses: number; wins: number; pnl: number };
  week: { wins: number; losses: number; pnl: number };
  month: { wins: number; losses: number; pnl: number };
  allTime: { wins: number; losses: number; total: number; winRate: string };
  recentOutcomes: string[];
  openTrades: Array<{
    _id: string;
    pair: string;
    direction: string;
    entryPrice: number;
    setupGrade: string;
    aiConfidence: number;
    createdAt: string;
  }>;
}

interface ScannerStatus {
  scannerEnabled: boolean;
  lastScanTime: string | null;
  lastCycleResults: Array<{
    pair: string;
    prefilterPassed: boolean;
    prefilterReasons: string[];
    prefilterDetails: {
      h4TrendDirection: string;
      h4TrendClarity: boolean;
      premiumDiscountZone: string;
      inKillZone: boolean;
      killZoneName: string;
      h1SweepDetected: boolean;
      h1MaxWickRatio: number;
      h1Displacement: boolean;
      h1BodyRatio: number;
    };
    setupGrade: string;
    overallVerdict: string;
    confidence: number;
  }>;
  recentAlerts: Array<{
    pair: string;
    setupGrade: string;
    overallVerdict: string;
    confidence: number;
    timestamp: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanner, setScanner] = useState<ScannerStatus | null>(null);
  const [togglingScanner, setTogglingScanner] = useState(false);
  const router = useRouter();

  const fetchScannerStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/scanner/status");
      if (res.ok) {
        const data = await res.json();
        setScanner(data);
      }
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      if (!data.authenticated) {
        router.push("/login");
        return;
      }
      fetchStats();
      fetchScannerStatus();
    };
    checkAuth();
  }, [router, fetchScannerStatus]);

  // Poll scanner status every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchScannerStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchScannerStatus]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Stats will show as empty
    } finally {
      setLoading(false);
    }
  };

  const toggleScanner = async () => {
    setTogglingScanner(true);
    try {
      const action = scanner?.scannerEnabled ? "stop" : "start";
      const res = await fetch("/api/scanner/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchScannerStatus();
      }
    } catch {
      // Silent
    } finally {
      setTogglingScanner(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  const formatPnl = (pnl: number) => {
    const formatted = `$${Math.abs(pnl).toFixed(2)}`;
    return pnl >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight mb-1">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <Link href="/analyze">
            <Button className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 px-6">
              New Analysis
            </Button>
          </Link>
        </div>

        {/* Scanner Panel */}
        {scanner && (
          <div className="mb-8 space-y-4">
            {/* Scanner Alert - A/A+ Setup Detected */}
            {scanner.recentAlerts.length > 0 && (
              <div className="bg-yellow-500/5 border-2 border-yellow-500/30 rounded-xl p-5 animate-pulse">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-yellow-500 mb-1">
                      Setup Detected
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      {scanner.recentAlerts.map((alert, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-sm font-bold border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                        >
                          {alert.pair} - {alert.setupGrade} ({alert.confidence}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Link href="/analyze">
                    <Button className="bg-yellow-500 text-black font-bold hover:bg-yellow-400">
                      Analyze Now
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Scanner Status Card */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      scanner.scannerEnabled
                        ? "bg-green-500 animate-pulse"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Auto Scanner
                  </h3>
                  {scanner.lastScanTime && (
                    <span className="text-[10px] text-muted-foreground/60">
                      Last scan: {new Date(scanner.lastScanTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleScanner}
                  disabled={togglingScanner}
                  className={`text-xs font-bold ${
                    scanner.scannerEnabled
                      ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
                      : "border-green-500/30 text-green-500 hover:bg-green-500/10"
                  }`}
                >
                  {togglingScanner
                    ? "..."
                    : scanner.scannerEnabled
                    ? "Stop Scanner"
                    : "Start Scanner"}
                </Button>
              </div>

              {/* Pair Results */}
              {scanner.lastCycleResults.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {scanner.lastCycleResults.map((result) => (
                    <div
                      key={result.pair}
                      className={`rounded-lg p-3 border ${
                        result.prefilterPassed
                          ? "bg-green-500/5 border-green-500/20"
                          : "bg-secondary/50 border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold">{result.pair}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            result.prefilterPassed
                              ? "text-green-500 border-green-500/30"
                              : "text-muted-foreground border-border"
                          }`}
                        >
                          {result.prefilterPassed ? "PASS" : "FAIL"}
                        </Badge>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${
                            result.prefilterDetails?.h4TrendDirection !== "RANGING"
                              ? "text-green-500 border-green-500/20"
                              : "text-muted-foreground/50 border-border"
                          }`}
                        >
                          {result.prefilterDetails?.h4TrendDirection?.[0] || "?"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${
                            result.prefilterDetails?.inKillZone
                              ? "text-green-500 border-green-500/20"
                              : "text-muted-foreground/50 border-border"
                          }`}
                        >
                          KZ
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${
                            result.prefilterDetails?.h1SweepDetected
                              ? "text-green-500 border-green-500/20"
                              : "text-muted-foreground/50 border-border"
                          }`}
                        >
                          SW
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${
                            result.prefilterDetails?.h1Displacement
                              ? "text-green-500 border-green-500/20"
                              : "text-muted-foreground/50 border-border"
                          }`}
                        >
                          DP
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${
                            result.prefilterDetails?.premiumDiscountZone !== "EQUILIBRIUM"
                              ? "text-green-500 border-green-500/20"
                              : "text-muted-foreground/50 border-border"
                          }`}
                        >
                          {result.prefilterDetails?.premiumDiscountZone?.[0] || "?"}
                        </Badge>
                      </div>
                      {result.setupGrade && (
                        <div className="mt-1.5 text-xs font-bold text-primary">
                          AI: {result.setupGrade} - {result.overallVerdict}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">
                  {scanner.scannerEnabled
                    ? "Waiting for first scan cycle... (Press F11 in MT5 Bridge)"
                    : "Scanner is off. Enable it to auto-detect setups across multiple pairs."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Today's Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Today&apos;s Trades
            </p>
            <p className="text-3xl font-black text-primary">
              {stats?.today.tradesCount ?? 0}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Today&apos;s P&L
            </p>
            <p
              className={`text-3xl font-black ${
                (stats?.today.pnl ?? 0) >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatPnl(stats?.today.pnl ?? 0)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Win Rate
            </p>
            <p className="text-3xl font-black text-primary">
              {stats?.allTime.winRate ?? "0"}%
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Total Trades
            </p>
            <p className="text-3xl font-black text-foreground">
              {stats?.allTime.total ?? 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Weekly & Monthly */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                  This Week
                </h3>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold text-green-500">
                    {stats?.week.wins ?? 0}W
                  </span>
                  <span className="text-sm font-bold text-red-500">
                    {stats?.week.losses ?? 0}L
                  </span>
                </div>
                <p
                  className={`text-xl font-black ${
                    (stats?.week.pnl ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {formatPnl(stats?.week.pnl ?? 0)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                  This Month
                </h3>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold text-green-500">
                    {stats?.month.wins ?? 0}W
                  </span>
                  <span className="text-sm font-bold text-red-500">
                    {stats?.month.losses ?? 0}L
                  </span>
                </div>
                <p
                  className={`text-xl font-black ${
                    (stats?.month.pnl ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {formatPnl(stats?.month.pnl ?? 0)}
                </p>
              </div>
            </div>

            {/* Open Trades */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Open Trades
              </h3>
              {stats?.openTrades && stats.openTrades.length > 0 ? (
                <div className="space-y-3">
                  {stats.openTrades.map((trade) => (
                    <Link
                      key={trade._id}
                      href={`/journal?trade=${trade._id}`}
                      className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-3">
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
                        <span className="text-xs text-muted-foreground">
                          @ {trade.entryPrice}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="text-primary border-primary/30"
                        >
                          {trade.setupGrade}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(trade.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No open trades. Start a new analysis to find setups.
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Outcomes */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Recent Results
              </h3>
              {stats?.recentOutcomes && stats.recentOutcomes.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {stats.recentOutcomes.map((outcome, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        outcome === "win"
                          ? "bg-green-500/15 text-green-500"
                          : outcome === "loss"
                          ? "bg-red-500/15 text-red-500"
                          : "bg-yellow-500/15 text-yellow-500"
                      }`}
                    >
                      {outcome === "win" ? "W" : outcome === "loss" ? "L" : "B"}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No trades yet</p>
              )}
            </div>

            {/* Rules */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Today&apos;s Rules
              </h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <div>&#9670; Max 3 trades</div>
                <div>&#9670; Max 1% risk per trade</div>
                <div>&#9670; Stop after 2 losses</div>
                <div>&#9670; Only London/NY overlap</div>
                <div>&#9670; Min 1:2 R:R</div>
                <div>&#9670; No news trading</div>
              </div>
            </div>

            {/* Affirmation */}
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                Daily Affirmation
              </h3>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &quot;I don&apos;t need to trade today. I only need to follow my
                rules. The money comes from discipline, not from the market.&quot;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
