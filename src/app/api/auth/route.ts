import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expected = process.env.AUTH_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const token = Buffer.from(`authenticated:${expected}`)
    .toString("base64")
    .slice(0, 32);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
