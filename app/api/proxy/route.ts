import { NextRequest, NextResponse } from 'next/server';
import { URL } from 'url';

// Set to false for production
const DEBUG = false;

// Performance-optimized URL rewriter without using JSDOM
function rewriteContent(content: string, targetUrl: string, contentType: string): string {
  const parsedUrl = new URL(targetUrl);
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
  const basePath = parsedUrl.pathname.substring(0, parsedUrl.pathname.lastIndexOf('/') || 0);
  
  // For HTML content
  if (contentType.includes('text/html')) {
    // Function to convert relative URLs to absolute
    const toProxyUrl = (url: string): string => {
      if (!url || url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#')) {
        return url;
      }
      
      let absoluteUrl = url;
      
      // Convert to absolute URL
      if (url.startsWith('//')) {
        absoluteUrl = `https:${url}`;
      } else if (url.startsWith('/')) {
        absoluteUrl = `${baseUrl}${url}`;
      } else if (!url.match(/^https?:\/\//i)) {
        absoluteUrl = `${baseUrl}${basePath}/${url}`;
      }
      
      // Return proxied URL
      return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
    };
    
    // Fast string replacement for HTML attributes
    return content
      // Replace src attributes
      .replace(/(\ssrc=["'])((?!data:|blob:|javascript:).+?)(["'])/gi, (match: string, prefix: string, url: string, suffix: string) => {
        return `${prefix}${toProxyUrl(url)}${suffix}`;
      })
      // Replace href attributes
      .replace(/(\shref=["'])((?!data:|blob:|javascript:|#).+?)(["'])/gi, (match: string, prefix: string, url: string, suffix: string) => {
        return `${prefix}${toProxyUrl(url)}${suffix}`;
      })
      // Replace background images in style attributes
      .replace(/(\sstyle=["'].*?url\(["']?)((?!data:|blob:).+?)(["']?\).*?["'])/gi, (match: string, prefix: string, url: string, suffix: string) => {
        return `${prefix}${toProxyUrl(url)}${suffix}`;
      })
      // Replace srcset attributes
      .replace(/(\ssrcset=["'])(.*?)(["'])/gi, (match: string, prefix: string, srcset: string, suffix: string) => {
        // Split srcset into individual entries
        const newSrcset = srcset.split(',').map((part: string) => {
          const parts = part.trim().split(/\s+/);
          const url = parts[0];
          const descriptor = parts.slice(1).join(' ');
          if (!url) return part;
          return `${toProxyUrl(url)} ${descriptor || ''}`.trim();
        }).join(', ');
        return `${prefix}${newSrcset}${suffix}`;
      })
      // Replace CSS @import urls
      .replace(/(@import\s+["'])((?!data:|blob:).+?)(["'])/gi, (match: string, prefix: string, url: string, suffix: string) => {
        return `${prefix}${toProxyUrl(url)}${suffix}`;
      })
      // Replace CSS url() functions in style tags
      .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (match: string, startTag: string, cssContent: string, endTag: string) => {
        const processedCss = cssContent.replace(/url\(["']?((?!data:|blob:).+?)["']?\)/gi, (match: string, url: string) => {
          return `url("${toProxyUrl(url)}")`;
        });
        return `${startTag}${processedCss}${endTag}`;
      })
      // Add anti-frame-busting script
      .replace('</head>', `
        <script>
          // Prevent frame detection
          try {
            // Override window.top, parent, self and frameElement
            Object.defineProperty(window, 'top', { get: function() { return window; } });
            Object.defineProperty(window, 'parent', { get: function() { return window; } });
            Object.defineProperty(window, 'self', { get: function() { return window; } });
            Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
            
            // Override common frame-busting functions
            window.open = function(url, ...args) {
              if (url && typeof url === 'string' && !url.startsWith('javascript:')) {
                location.href = '/api/proxy?url=' + encodeURIComponent(url);
                return window;
              }
              return window;
            };
            
            // Override location methods
            const originalLocation = window.location;
            Object.defineProperty(window, 'location', {
              get: function() { return originalLocation; },
              set: function(url) {
                if (typeof url === 'string' && !url.startsWith('javascript:')) {
                  originalLocation.href = '/api/proxy?url=' + encodeURIComponent(url);
                }
                return url;
              }
            });
            
            // Override document.domain
            Object.defineProperty(document, 'domain', {
              get: function() { return '${parsedUrl.hostname}'; },
              set: function() { return '${parsedUrl.hostname}'; }
            });
          } catch(e) { console.warn('Frame protection override failed:', e); }
        </script>
      </head>`);
  }
  
  // For CSS content
  if (contentType.includes('text/css')) {
    return content.replace(/url\(["']?((?!data:|blob:).+?)["']?\)/gi, (match: string, url: string) => {
      if (!url) return match;
      
      let absoluteUrl = url;
      
      // Convert to absolute URL
      if (url.startsWith('//')) {
        absoluteUrl = `https:${url}`;
      } else if (url.startsWith('/')) {
        absoluteUrl = `${baseUrl}${url}`;
      } else if (!url.match(/^https?:\/\//i)) {
        absoluteUrl = `${baseUrl}${basePath}/${url}`;
      }
      
      return `url("/api/proxy?url=${encodeURIComponent(absoluteUrl)}")`;
    });
  }
  
  // For JavaScript content, we could add script modifications here if needed
  
  return content;
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
    // For performance, reduce timeout to 15s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    // Custom headers to mimic a real browser
    const headers = new Headers({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': new URL(targetUrl).origin,
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Cache-Control': 'no-cache'
    });
    
    // Perform the fetch request
    const fetchResponse = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    // Get content type
    const contentType = fetchResponse.headers.get('content-type') || '';
    
    // Create response headers (strip security headers)
    const responseHeaders = new Headers();
    fetchResponse.headers.forEach((value, key) => {
      // Skip security headers that would prevent embedding
      if (!['x-frame-options', 'content-security-policy', 'frame-options'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    
    // Always set content type
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('X-Proxy-Source', targetUrl);
    
    // Don't cache responses
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('Expires', '0');
    
    // For text content types, rewrite URLs
    if (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml')) {
      const text = await fetchResponse.text();
      const processedContent = rewriteContent(text, targetUrl, contentType);
      
      return new NextResponse(processedContent, {
        status: fetchResponse.status,
        headers: responseHeaders
      });
    } else {
      // For binary content, just pass it through
      const buffer = await fetchResponse.arrayBuffer();
      
      return new NextResponse(buffer, {
        status: fetchResponse.status,
        headers: responseHeaders
      });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    
    // Simple error page for better performance
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Proxy Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; text-align: center; background: #f8f9fa; }
            .error-container { max-width: 600px; margin: 50px auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; }
            h1 { color: #e74c3c; }
            button { padding: 10px 20px; margin: 10px; border: none; border-radius: 5px; cursor: pointer; }
            .retry { background: #3498db; color: white; }
            .back { background: #f1f1f1; color: #333; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Connection Error</h1>
            <p>Sorry, we couldn't connect to the requested website.</p>
            <p>Error: ${error instanceof Error ? error.message : 'Network error'}</p>
            <button class="retry" onclick="window.location.reload()">Try Again</button>
            <button class="back" onclick="window.history.back()">Go Back</button>
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