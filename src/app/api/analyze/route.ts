import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Settings } from "@/lib/models/Settings";
import { Trade } from "@/lib/models/Trade";
import { verifyAuth } from "@/lib/auth";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
import { analyzeWithOpenAI } from "@/lib/ai/openai";
import { analyzeWithClaude } from "@/lib/ai/claude";
import { todayDateStr } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const { pair, screenshot } = await req.json();

    if (!pair || !screenshot) {
      return NextResponse.json(
        { error: "Pair and screenshot are required" },
        { status: 400 }
      );
    }

    // Get settings
    const settings = await Settings.findOne();
    if (!settings) {
      return NextResponse.json(
        { error: "Please configure settings first" },
        { status: 400 }
      );
    }

    const apiKey =
      settings.aiProvider === "claude" ? settings.claudeApiKey : settings.openaiApiKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: `Please set your ${settings.aiProvider === "claude" ? "Claude" : "OpenAI"} API key in settings` },
        { status: 400 }
      );
    }

    // Get today's trading context
    const today = todayDateStr();
    const todayStart = new Date(today + "T00:00:00.000Z");
    const todayEnd = new Date(today + "T23:59:59.999Z");

    const todayTrades = await Trade.find({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    const tradesToday = todayTrades.length;
    const lossesToday = todayTrades.filter((t) => t.outcome === "loss").length;

    // Recent outcomes
    const recentTrades = await Trade.find({ outcome: { $ne: "open" } })
      .sort({ closedAt: -1 })
      .limit(10);
    const recentOutcomes = recentTrades.map((t) => t.outcome);

    // Drawdown calculation
    const drawdownPct =
      ((settings.accountSize - settings.accountBalance) / settings.accountSize) * 100;

    // Build prompt
    const systemPrompt = buildAnalysisPrompt({
      pair,
      accountBalance: settings.accountBalance,
      riskPercentage: settings.riskPercentage,
      tradesToday,
      lossesToday,
      maxTradesPerDay: settings.maxTradesPerDay,
      maxDailyLosses: settings.maxDailyLosses,
      recentOutcomes,
      currentDrawdownPct: Math.max(0, drawdownPct),
    });

    // Strip the data URL prefix if present
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

    // Call AI
    let analysis: Record<string, unknown>;
    if (settings.aiProvider === "claude") {
      analysis = await analyzeWithClaude(apiKey, systemPrompt, base64Data);
    } else {
      analysis = await analyzeWithOpenAI(apiKey, systemPrompt, base64Data);
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
