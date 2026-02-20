import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Trade } from "@/lib/models/Trade";
import { verifyAuth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const trade = await Trade.findById(id);
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(trade);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const body = await req.json();

  if (body.outcome && body.outcome !== "open") {
    body.closedAt = new Date();
  }

  const trade = await Trade.findByIdAndUpdate(id, body, { new: true });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(trade);
}
