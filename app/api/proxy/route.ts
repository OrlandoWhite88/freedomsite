// app/api/simple-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import { createNavigationScript } from './navigation-helper';

export async function GET(request: NextRequest) {
  // Get target URL and service name from the query parameters
  const url = request.nextUrl;
  let targetUrl = url.searchParams.get('url');
  const serviceName = url.searchParams.get('service') || 'Unknown Service';
  
  if (!targetUrl) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }
  
  // Ensure URL has protocol
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  // Determine the service name from the URL if not provided
  let effectiveServiceName = serviceName;
  if (serviceName === 'Unknown Service') {
    try {
      const urlObj = new URL(targetUrl);
      // Extract domain without subdomains (e.g., netflix.com from www.netflix.com)
      const domainParts = urlObj.hostname.split('.');
      if (domainParts.length >= 2) {
        const domain = domainParts[domainParts.length - 2];
        effectiveServiceName = domain.charAt(0).toUpperCase() + domain.slice(1);
      }
    } catch (e) {
      console.error('Error parsing URL for service name:', e);
    }
  }
  
  try {
    // Fetch the target website with appropriate headers
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': new URL(targetUrl).origin,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
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
    ['a', 'link', 'script', 'img', 'iframe', 'source', 'video', 'audio'].forEach(tagName => {
      document.querySelectorAll(tagName).forEach(el => {
        // Handle href attributes
        if (el.hasAttribute('href')) {
          const href = el.getAttribute('href');
          if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('data:')) {
            try {
              const absoluteUrl = new URL(href, targetUrl).href;
              el.setAttribute('href', `/api/simple-proxy?url=${encodeURIComponent(absoluteUrl)}&service=${encodeURIComponent(effectiveServiceName)}`);
            } catch (e) {
              console.error(`Failed to process href: ${href}`);
            }
          }
        }
        
        // Handle src attributes
        if (el.hasAttribute('src')) {
          const src = el.getAttribute('src');
          if (src && !src.startsWith('data:') && !src.startsWith('blob:') && !src.includes('api/simple-proxy')) {
            try {
              const absoluteUrl = new URL(src, targetUrl).href;
              el.setAttribute('src', `/api/simple-proxy?url=${encodeURIComponent(absoluteUrl)}&service=${encodeURIComponent(effectiveServiceName)}`);
            } catch (e) {
              console.error(`Failed to process src: ${src}`);
            }
          }
        }
        
        // Handle srcset for responsive images
        if (el.hasAttribute('srcset')) {
          const srcset = el.getAttribute('srcset');
          if (srcset) {
            try {
              // Parse and rewrite each URL in the srcset
              const newSrcset = srcset.split(',').map(srcsetPart => {
                const [url, descriptor] = srcsetPart.trim().split(/\s+/);
                if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
                  const absoluteUrl = new URL(url, targetUrl).href;
                  return `/api/simple-proxy?url=${encodeURIComponent(absoluteUrl)}&service=${encodeURIComponent(effectiveServiceName)} ${descriptor || ''}`;
                }
                return srcsetPart;
              }).join(', ');
              
              el.setAttribute('srcset', newSrcset);
            } catch (e) {
              console.error(`Failed to process srcset: ${srcset}`);
            }
          }
        }
      });
    });
    
    // Process all CSS rules in style tags to rewrite urls()
    document.querySelectorAll('style').forEach(styleEl => {
      const css = styleEl.textContent || '';
      const processedCss = css.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
        try {
          const absoluteUrl = new URL(url, targetUrl).href;
          return `url("/api/simple-proxy?url=${encodeURIComponent(absoluteUrl)}&service=${encodeURIComponent(effectiveServiceName)}")`;
        } catch (e) {
          console.error(`Failed to process CSS URL: ${url}`);
          return match;
        }
      });
      styleEl.textContent = processedCss;
    });
    
    // Process inline styles
    document.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const processedStyle = style.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
        try {
          const absoluteUrl = new URL(url, targetUrl).href;
          return `url("/api/simple-proxy?url=${encodeURIComponent(absoluteUrl)}&service=${encodeURIComponent(effectiveServiceName)}")`;
        } catch (e) {
          console.error(`Failed to process inline style URL: ${url}`);
          return match;
        }
      });
      el.setAttribute('style', processedStyle);
    });
    
    // Add base tag for relative URLs
    const head = document.querySelector('head');
    if (head) {
      let baseTag = document.querySelector('base');
      if (!baseTag) {
        baseTag = document.createElement('base');
        baseTag.setAttribute('href', targetUrl);
        head.insertBefore(baseTag, head.firstChild);
      } else {
        const baseHref = baseTag.getAttribute('href');
        if (baseHref) {
          const absoluteBaseUrl = new URL(baseHref, targetUrl).href;
          baseTag.setAttribute('href', absoluteBaseUrl);
        } else {
          baseTag.setAttribute('href', targetUrl);
        }
      }
    }
    
    // Inject frame busting prevention script
    const frameBustingScript = document.createElement('script');
    frameBustingScript.textContent = `
      // Override frame detection properties
      try {
        Object.defineProperty(window, 'self', { get: function() { return window.top; } });
        Object.defineProperty(window, 'top', { get: function() { return window; } });
        Object.defineProperty(window, 'parent', { get: function() { return window; } });
        Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
      } catch(e) {
        console.warn('Failed to override frame detection:', e);
      }
    `;
    if (head) {
      head.appendChild(frameBustingScript);
    }
    
    // Inject our navigation helper into the beginning of the body
    const body = document.querySelector('body');
    if (body) {
      const navDiv = document.createElement('div');
      navDiv.innerHTML = createNavigationScript(effectiveServiceName);
      body.insertBefore(navDiv, body.firstChild);
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
    
    // Create an error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Proxy Error</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { color: #e53e3e; }
            .error-box { background-color: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; padding: 1.5rem; margin: 2rem 0; }
            .actions { margin-top: 2rem; }
            .button { display: inline-block; background: #3182ce; color: white; padding: 0.5rem 1rem; border-radius: 0.25rem; text-decoration: none; margin-right: 0.5rem; }
            .button.secondary { background: #718096; }
          </style>
        </head>
        <body>
          <h1>Proxy Error</h1>
          <p>We encountered an error while trying to access: <strong>${targetUrl}</strong></p>
          
          <div class="error-box">
            <h3>Error Details:</h3>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
          
          <div class="actions">
            <a href="/" class="button">Back to Dashboard</a>
            <a href="/api/simple-proxy?url=${encodeURIComponent(targetUrl)}&_retry=true" class="button">Try Again</a>
          </div>
        </body>
      </html>
    `;
    
    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html'
      }
    });
  }
}

// Support POST, PUT, etc. methods
export async function POST(request: NextRequest) {
  return handleRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return handleRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request, 'PATCH');
}

async function handleRequest(request: NextRequest, method: string) {
  const url = request.nextUrl;
  let targetUrl = url.searchParams.get('url');
  const serviceName = url.searchParams.get('service') || 'Unknown Service';
  
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
    
    // Set appropriate referer
    headers.set('Referer', new URL(targetUrl).origin);
    
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
      { error: 'Failed to fetch the requested URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}