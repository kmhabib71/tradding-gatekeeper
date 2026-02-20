import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { ScanResult } from "@/lib/models/ScanResult";
import { runPrefilter, type PrefilterInput } from "@/lib/scanner/prefilter";

export async function POST(req: NextRequest) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const body = await req.json();

    // Handle AI analysis update for an existing scan result
    if (body.updateScanResult) {
      const { scanCycleId, pair, aiAnalysis } = body;
      await ScanResult.findOneAndUpdate(
        { scanCycleId, pair },
        {
          aiAnalysis,
          setupGrade: aiAnalysis?.setupGrade || "",
          overallVerdict: aiAnalysis?.overallVerdict || "",
          confidence: aiAnalysis?.confidence || 0,
        }
      );
      return NextResponse.json({ success: true });
    }

    // Stage 1: Run pre-filter on OHLC data
    const { pairs } = body as {
      pairs: Record<string, { h4: unknown[]; h1: unknown[]; m15: unknown[]; m5: unknown[] }>;
    };

    if (!pairs || Object.keys(pairs).length === 0) {
      return NextResponse.json({ error: "No pair data provided" }, { status: 400 });
    }

    const scanCycleId = Date.now().toString(36);
    const results: Record<string, { passed: boolean; reasons: string[] }> = {};
    const triggeredPairs: string[] = [];

    for (const [pair, data] of Object.entries(pairs)) {
      const input: PrefilterInput = {
        pair,
        h4: data.h4 as PrefilterInput["h4"],
        h1: data.h1 as PrefilterInput["h1"],
        m15: data.m15 as PrefilterInput["m15"],
        m5: data.m5 as PrefilterInput["m5"],
      };

      const result = runPrefilter(input);

      // Save scan result
      await ScanResult.create({
        pair,
        scanCycleId,
        timestamp: new Date(),
        prefilterPassed: result.passed,
        prefilterReasons: result.reasons,
        prefilterDetails: result.details,
      });

      results[pair] = { passed: result.passed, reasons: result.reasons };
      if (result.passed) {
        triggeredPairs.push(pair);
      }
    }

    return NextResponse.json({ scanCycleId, results, triggeredPairs });
  } catch (error) {
    console.error("Scanner prefilter error:", error);
    const message = error instanceof Error ? error.message : "Prefilter failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
