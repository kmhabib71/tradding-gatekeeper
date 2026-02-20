import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  const isAuth = await verifyAuth();
  return NextResponse.json({ authenticated: isAuth });
}
