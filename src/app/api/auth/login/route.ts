import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const appPassword = process.env.APP_PASSWORD;

    if (!appPassword || password !== appPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = signToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set("gatekeeper_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
