import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { ScanResult } from "@/lib/models/ScanResult";
import { Settings } from "@/lib/models/Settings";

export async function GET() {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const settings = await Settings.findOne();
    const scannerEnabled = settings?.scannerEnabled ?? false;

    // Get the most recent scan cycle
    const latestScan = await ScanResult.findOne().sort({ timestamp: -1 });
    let lastCycleResults: InstanceType<typeof ScanResult>[] = [];

    if (latestScan) {
      lastCycleResults = await ScanResult.find({
        scanCycleId: latestScan.scanCycleId,
      }).sort({ pair: 1 });
    }

    // Get recent A/A+ alerts from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = await ScanResult.find({
      timestamp: { $gte: oneDayAgo },
      setupGrade: { $in: ["A+", "A"] },
    })
      .sort({ timestamp: -1 })
      .limit(10);

    return NextResponse.json({
      scannerEnabled,
      lastScanTime: latestScan?.timestamp || null,
      lastCycleResults: lastCycleResults.map((r) => ({
        pair: r.pair,
        prefilterPassed: r.prefilterPassed,
        prefilterReasons: r.prefilterReasons,
        prefilterDetails: r.prefilterDetails,
        setupGrade: r.setupGrade,
        overallVerdict: r.overallVerdict,
        confidence: r.confidence,
      })),
      recentAlerts: recentAlerts.map((r) => ({
        pair: r.pair,
        setupGrade: r.setupGrade,
        overallVerdict: r.overallVerdict,
        confidence: r.confidence,
        timestamp: r.timestamp,
      })),
    });
  } catch (error) {
    console.error("Scanner status error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
