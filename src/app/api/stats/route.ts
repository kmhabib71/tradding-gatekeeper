import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Trade } from "@/lib/models/Trade";
import { verifyAuth } from "@/lib/auth";
import { todayDateStr } from "@/lib/utils";

export async function GET() {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const today = todayDateStr();
  const todayStart = new Date(today + "T00:00:00.000Z");
  const todayEnd = new Date(today + "T23:59:59.999Z");

  // Today's trades
  const todayTrades = await Trade.find({
    createdAt: { $gte: todayStart, $lte: todayEnd },
  });

  const todayTradesCount = todayTrades.length;
  const todayLosses = todayTrades.filter((t) => t.outcome === "loss").length;
  const todayWins = todayTrades.filter((t) => t.outcome === "win").length;
  const todayPnl = todayTrades.reduce((sum, t) => sum + (t.pnlAmount || 0), 0);

  // This week (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekTrades = await Trade.find({
    createdAt: { $gte: weekAgo },
    outcome: { $ne: "open" },
  });
  const weekWins = weekTrades.filter((t) => t.outcome === "win").length;
  const weekLosses = weekTrades.filter((t) => t.outcome === "loss").length;
  const weekPnl = weekTrades.reduce((sum, t) => sum + (t.pnlAmount || 0), 0);

  // This month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthTrades = await Trade.find({
    createdAt: { $gte: monthStart },
    outcome: { $ne: "open" },
  });
  const monthWins = monthTrades.filter((t) => t.outcome === "win").length;
  const monthLosses = monthTrades.filter((t) => t.outcome === "loss").length;
  const monthPnl = monthTrades.reduce((sum, t) => sum + (t.pnlAmount || 0), 0);

  // All time
  const allTrades = await Trade.find({ outcome: { $ne: "open" } });
  const totalWins = allTrades.filter((t) => t.outcome === "win").length;
  const totalLosses = allTrades.filter((t) => t.outcome === "loss").length;
  const totalTrades = allTrades.length;
  const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : "0";

  // Recent outcomes (last 10 closed trades)
  const recentTrades = await Trade.find({ outcome: { $ne: "open" } })
    .sort({ closedAt: -1 })
    .limit(10);
  const recentOutcomes = recentTrades.map((t) => t.outcome);

  // Open trades
  const openTrades = await Trade.find({ outcome: "open" }).sort({ createdAt: -1 });

  return NextResponse.json({
    today: {
      tradesCount: todayTradesCount,
      losses: todayLosses,
      wins: todayWins,
      pnl: todayPnl,
    },
    week: { wins: weekWins, losses: weekLosses, pnl: weekPnl },
    month: { wins: monthWins, losses: monthLosses, pnl: monthPnl },
    allTime: { wins: totalWins, losses: totalLosses, total: totalTrades, winRate },
    recentOutcomes,
    openTrades,
  });
}
