import { NextRequest, NextResponse } from 'next/server';

// This middleware will be applied to all routes based on the matcher
export function middleware(request: NextRequest) {
  // For API Proxy routes, handle CORS and other requirements
  if (request.nextUrl.pathname.startsWith('/api/proxy')) {
    // Set default CORS headers for all requests (not just preflight)
    const response = NextResponse.next();
    
    // Add required headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', '*');
    
    // CORS handling for preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400', // 24 hours
          'Content-Length': '0',
          'Content-Type': 'text/plain',
        },
      });
    }
    
    return response;
  }
  
  // Continue with standard middleware processing for non-proxy routes
  return NextResponse.next();
}

export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  // But specifically include the /api/proxy route
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/api/proxy/:path*',
  ],
};