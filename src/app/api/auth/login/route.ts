import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = Buffer.from(env.adminPassword());
  const given = Buffer.from(password ?? "");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(env.sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
