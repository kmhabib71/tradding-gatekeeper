import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Settings } from "@/lib/models/Settings";

// In-memory store for latest MT5 data (single user app)
let latestMT5Data: Record<string, unknown> | null = null;

export async function POST(req: NextRequest) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await req.json();
    latestMT5Data = {
      ...data,
      receivedAt: new Date().toISOString(),
    };

    // Sync MT5 balance to Settings so AI analysis uses the real balance
    if (data.account?.balance) {
      await connectDB();
      await Settings.findOneAndUpdate(
        {},
        { accountBalance: data.account.balance },
        { upsert: false }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}

export async function GET() {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(latestMT5Data || { empty: true });
}
