import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Allow seamless access to all dashboard and analysis pages
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/analyze/:path*", "/history/:path*", "/analytics/:path*", "/settings/:path*", "/login", "/register"],
};
