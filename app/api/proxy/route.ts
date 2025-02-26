import { NextRequest, NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';

export async function GET(request: NextRequest) {
  // Get target URL from the query parameter
  const url = request.nextUrl;
  let targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }
  
  // Ensure URL has protocol
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    // Fetch the target website
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      }
    });

    const contentType = response.headers.get('content-type') || '';
    
    // For non-HTML content, just pass it through
    if (!contentType.includes('text/html')) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: response.status,
        headers: {
          'Content-Type': contentType
        }
      });
    }
    
    // For HTML content, rewrite links to maintain proxy
    const html = await response.text();
    const dom = new JSDOM(html, { url: targetUrl });
    const document = dom.window.document;
    
    // Rewrite all links to go through our proxy
    ['a', 'link', 'script', 'img', 'iframe', 'source'].forEach(tagName => {
      document.querySelectorAll(tagName).forEach(el => {
        // Handle href attributes
        if (el.hasAttribute('href')) {
          const href = el.getAttribute('href');
          if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('data:')) {
            try {
              const absoluteUrl = new URL(href, targetUrl).href;
              el.setAttribute('href', `/api/simple-proxy?url=${encodeURIComponent(absoluteUrl)}`);
            } catch (e) {
              console.error(`Failed to process href: ${href}`);
            }
          }
        }
        
        // Handle src attributes
        if (el.hasAttribute('src')) {
          const src = el.getAttribute('src');
          if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
            try {
              const absoluteUrl = new URL(src, targetUrl).href;
              el.setAttribute('src', `/api/simple-proxy?url=${encodeURIComponent(absoluteUrl)}`);
            } catch (e) {
              console.error(`Failed to process src: ${src}`);
            }
          }
        }
      });
    });
    
    // Add base tag to ensure relative URLs resolve correctly
    const head = document.querySelector('head');
    if (head) {
      let baseTag = document.querySelector('base');
      if (!baseTag) {
        baseTag = document.createElement('base');
        baseTag.setAttribute('href', targetUrl);
        head.insertBefore(baseTag, head.firstChild);
      }
    }
    
    // Return the modified HTML
    return new NextResponse(dom.serialize(), {
      status: 200,
      headers: {
        'Content-Type': 'text/html'
      }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch the requested URL' },
      { status: 500 }
    );
  }
}

// Support POST, PUT, etc. methods
export async function POST(request: NextRequest) {
  return handleRequest(request, 'POST');
}

async function handleRequest(request: NextRequest, method: string) {
  const url = request.nextUrl;
  let targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }
  
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    // Copy headers from original request
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });
    
    // Forward the body for POST/PUT/PATCH requests
    const body = method !== 'GET' ? await request.text() : undefined;
    
    // Fetch the target URL
    const response = await fetch(targetUrl, {
      method,
      headers,
      body
    });
    
    // Forward the response back to the client
    const contentType = response.headers.get('content-type');
    const responseBuffer = await response.arrayBuffer();
    
    return new NextResponse(responseBuffer, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/octet-stream'
      }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch the requested URL' },
      { status: 500 }
    );
  }
}