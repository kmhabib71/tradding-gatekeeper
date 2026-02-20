import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Trade } from "@/lib/models/Trade";
import { verifyAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const outcome = searchParams.get("outcome");

  const filter: Record<string, unknown> = {};
  if (outcome) filter.outcome = outcome;

  const trades = await Trade.find(filter).sort({ createdAt: -1 }).limit(limit);
  return NextResponse.json(trades);
}

export async function POST(req: NextRequest) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const trade = await Trade.create(body);
  return NextResponse.json(trade, { status: 201 });
}
