"use client";

import { useEffect, useState } from "react";
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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      if (!data.authenticated) {
        router.push("/login");
        return;
      }
      fetchStats();
    };
    checkAuth();
  }, [router]);

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
