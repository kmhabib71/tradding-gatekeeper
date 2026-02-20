import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Settings } from "@/lib/models/Settings";

export async function POST(req: NextRequest) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { action } = await req.json();

    if (action === "start") {
      await Settings.findOneAndUpdate({}, { scannerEnabled: true });
      return NextResponse.json({ scannerEnabled: true });
    }

    if (action === "stop") {
      await Settings.findOneAndUpdate({}, { scannerEnabled: false });
      return NextResponse.json({ scannerEnabled: false });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Scanner control error:", error);
    return NextResponse.json({ error: "Control action failed" }, { status: 500 });
  }
}

export async function GET() {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const settings = await Settings.findOne();
    return NextResponse.json({
      scannerEnabled: settings?.scannerEnabled ?? false,
      scanIntervalMinutes: settings?.scanIntervalMinutes ?? 15,
      scannerPairs: settings?.scannerPairs ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Failed to get state" }, { status: 500 });
  }
}
