import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

export function signToken(): string {
  return jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: "7d" });
}

export async function verifyAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("gatekeeper_token")?.value;
    if (!token) return false;
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}
