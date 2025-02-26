import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of allowed domains to proxy
const ALLOWED_DOMAINS = [
  'youtube.com', 'www.youtube.com',
  'netflix.com', 'www.netflix.com', 
  'poki.com', 'www.poki.com',
  'google.com', 'www.google.com'
];

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/proxy')) {
    const url = request.nextUrl.searchParams.get('url');
    
    if (url) {
      try {
        const targetUrl = new URL(
          url.startsWith('http') ? url : `https://${url}`
        );
        
        const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
          targetUrl.hostname === domain || targetUrl.hostname.endsWith(`.${domain}`)
        );
        
        if (!isAllowedDomain) {
          return NextResponse.json(
            { error: 'Domain not allowed' },
            { status: 403 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid URL' },
          { status: 400 }
        );
      }
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/proxy',
};