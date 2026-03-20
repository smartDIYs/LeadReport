import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API
  if (pathname === "/login" || pathname === "/api/auth") {
    return NextResponse.next();
  }

  // Check auth cookie
  const authToken = request.cookies.get("auth_token")?.value;
  const expectedToken = Buffer.from(
    `authenticated:${process.env.AUTH_PASSWORD}`
  )
    .toString("base64")
    .slice(0, 32);

  if (authToken !== expectedToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
