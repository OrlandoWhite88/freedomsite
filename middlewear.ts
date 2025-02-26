import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware runs before your routes are executed
export function middleware(request: NextRequest) {
  // Just let the proxy route handle requests without restriction
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};