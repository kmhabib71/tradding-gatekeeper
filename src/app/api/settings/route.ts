import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Settings } from "@/lib/models/Settings";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const isAuth = await verifyAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();

  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create(body);
  } else {
    Object.assign(settings, body);
    await settings.save();
  }

  return NextResponse.json(settings);
}
