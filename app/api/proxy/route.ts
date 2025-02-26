import { NextRequest, NextResponse } from 'next/server';
import { URL } from 'url';
import https from 'https';
import http from 'http';

// Function to create absolute URLs for resources
function createProxyUrl(originalUrl: string, targetHost: string, basePath: string): string {
  try {
    // Handle absolute URLs
    if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
      return `/api/proxy?url=${encodeURIComponent(originalUrl)}`;
    }
    
    // Handle protocol-relative URLs
    if (originalUrl.startsWith('//')) {
      return `/api/proxy?url=${encodeURIComponent(`https:${originalUrl}`)}`;
    }
    
    // Handle root-relative URLs
    if (originalUrl.startsWith('/')) {
      return `/api/proxy?url=${encodeURIComponent(`https://${targetHost}${originalUrl}`)}`;
    }
    
    // Handle relative URLs
    return `/api/proxy?url=${encodeURIComponent(`https://${targetHost}${basePath}/${originalUrl}`)}`;
  } catch (error) {
    console.error('URL rewriting error:', error);
    return originalUrl;
  }
}

// Function to rewrite HTML content to proxy all resources
function rewriteHtml(html: string, targetHost: string, basePath: string): string {
  // Replace all URLs in src and href attributes
  return html
    // Replace src attributes
    .replace(/src=["'](.*?)["']/g, (match, url) => {
      return `src="${createProxyUrl(url, targetHost, basePath)}"`;
    })
    // Replace href attributes
    .replace(/href=["'](.*?)["']/g, (match, url) => {
      // Don't proxy hash links or javascript: URLs
      if (url.startsWith('#') || url.startsWith('javascript:')) {
        return match;
      }
      return `href="${createProxyUrl(url, targetHost, basePath)}"`;
    })
    // Replace CSS url() function calls
    .replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
      // Don't proxy data: URLs
      if (url.startsWith('data:')) {
        return match;
      }
      return `url("${createProxyUrl(url, targetHost, basePath)}")`;
    })
    // Inject some anti-detection JavaScript
    .replace('</head>', `
      <script>
        // Attempt to hide the fact this is in an iframe
        try {
          // Override properties that might reveal we're in an iframe
          Object.defineProperty(window, 'self', { get: function() { return window.top; } });
          Object.defineProperty(window, 'top', { get: function() { return window; } });
          Object.defineProperty(window, 'parent', { get: function() { return window; } });
          Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
          
          // Override window.open to use our proxy
          const originalOpen = window.open;
          window.open = function(url, ...args) {
            if (url && !url.startsWith('javascript:')) {
              url = "${createProxyUrl('PLACEHOLDER_URL', targetHost, basePath)}".replace('PLACEHOLDER_URL', url);
            }
            return originalOpen.call(this, url, ...args);
          };
        } catch(e) {
          console.warn('Anti-detection script failed:', e);
        }
      </script>
    </head>`);
}

// Function to modify CSS content to proxy all resources
function rewriteCss(css: string, targetHost: string, basePath: string): string {
  return css.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
    // Don't proxy data: URLs
    if (url.startsWith('data:')) {
      return match;
    }
    return `url("${createProxyUrl(url, targetHost, basePath)}")`;
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');
  
  if (!targetUrl) {
    return NextResponse.redirect('https://www.google.com');
  }
  
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    const parsedUrl = new URL(targetUrl);
    const basePath = parsedUrl.pathname.substring(0, parsedUrl.pathname.lastIndexOf('/') || 0);
    
    // Create request options
    const options = {
      method: 'GET',
      headers: {
        'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://${parsedUrl.hostname}`,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    
    // Make the request
    const fetchResponse = await fetch(targetUrl, options);
    
    // Read the response as text or buffer depending on content type
    const contentType = fetchResponse.headers.get('content-type') || '';
    let responseData;
    
    if (contentType.includes('text/html')) {
      // For HTML, we need to rewrite URLs
      const html = await fetchResponse.text();
      responseData = rewriteHtml(html, parsedUrl.hostname, basePath);
    } else if (contentType.includes('text/css')) {
      // For CSS, we need to rewrite URLs
      const css = await fetchResponse.text();
      responseData = rewriteCss(css, parsedUrl.hostname, basePath);
    } else {
      // For binary data, just pass it through
      responseData = new Uint8Array(await fetchResponse.arrayBuffer());
    }
    
    // Prepare headers (removing security headers that would prevent embedding)
    const responseHeaders = new Headers();
    
    fetchResponse.headers.forEach((value, key) => {
      // Skip headers that would prevent embedding
      if (
        key.toLowerCase() !== 'x-frame-options' && 
        key.toLowerCase() !== 'content-security-policy' &&
        key.toLowerCase() !== 'frame-options'
      ) {
        responseHeaders.set(key, value);
      }
    });
    
    // Ensure content type is set
    responseHeaders.set('Content-Type', contentType);
    
    // Return the proxied response
    return new NextResponse(responseData, {
      status: fetchResponse.status,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('Proxy error details:', error);
    
    // Return an HTML error page that can be displayed in the iframe
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Proxy Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
            .error-container { max-width: 600px; margin: 50px auto; }
            h1 { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Proxy Connection Error</h1>
            <p>Sorry, we couldn't connect to the requested website.</p>
            <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <p>Please try again or select a different service.</p>
          </div>
        </body>
      </html>
    `;
    
    return new NextResponse(errorHtml, { 
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}