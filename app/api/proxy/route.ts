import { NextRequest, NextResponse }

// Export handler for GET requests
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

// Export handler for POST requests - important for forms, logins, etc.
export async function POST(request: NextRequest) {
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
    
    // Copy headers from the original request
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      // Skip host header as it will be set by fetch
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });
    
    // Set additional browser-like headers
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
    headers.set('Origin', `https://${parsedUrl.hostname}`);
    headers.set('Referer', `https://${parsedUrl.hostname}`);
    
    // Read the request body
    const contentType = request.headers.get('content-type');
    let requestBody: any;
    
    if (contentType && contentType.includes('application/json')) {
      requestBody = await request.json();
    } else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      requestBody = new URLSearchParams();
      formData.forEach((value, key) => {
        requestBody.append(key, value.toString());
      });
    } else if (contentType && contentType.includes('multipart/form-data')) {
      requestBody = await request.formData();
    } else {
      // Try to handle as text or binary
      try {
        requestBody = await request.text();
      } catch {
        requestBody = await request.arrayBuffer();
      }
    }

    // Forward the POST request to the target URL
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: requestBody,
      redirect: 'follow',
      credentials: 'include',
    });

    // Process the response
    const responseContentType = response.headers.get('content-type') || '';
    
    if (!responseContentType.includes('text/html')) {
      // For non-HTML responses, just forward the response
      const buffer = await response.arrayBuffer();
      
      const responseHeaders = new Headers();
      // Copy headers but remove security-related ones
      response.headers.forEach((value, key) => {
        if (!['x-frame-options', 'frame-options', 'content-security-policy'].includes(key.toLowerCase())) {
          responseHeaders.set(key, value);
        }
      });
      
      // Add our own headers
      responseHeaders.set('X-Proxy-Status', 'forwarded');
      responseHeaders.set('X-Proxy-Source', targetUrl);
      
      return new NextResponse(buffer, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // For HTML responses, we need to rewrite URLs
    const htmlContent = await response.text();
    
    // Create a response URL to handle redirects
    const finalUrl = response.url;
    const responseUrl = new URLSearchParams();
    responseUrl.set('url', finalUrl);
    
    // Create a redirect response that will go back through our proxy
    return NextResponse.redirect(new URL(`/api/proxy?${responseUrl.toString()}`, request.url));
  } catch (error) {
    console.error('Proxy POST error:', error);
    
    return NextResponse.json(
      {
        error: 'Proxy POST error',
        message: error instanceof Error ? error.message : 'Unknown error',
        targetUrl,
      },
      { status: 500 }
    );
  }
} from 'next/server';
import { URL } from 'url';
import { JSDOM } from 'jsdom';

const DEBUG = false; // Set to false in production for better performance

// List of domains that require special handling
const ALLOWED_DOMAINS = [
  // Add any specific domains you want to whitelist
];

// Domains that should bypass content rewriting (e.g., for video content or games)
const BYPASS_REWRITE_DOMAINS = [
  'poki-gdn.com',
  'assets.poki.com',
  'game-cdn.poki.com',
  'www.youtube.com',
  'i.ytimg.com',
  'yt3.ggpht.com',
  's.ytimg.com',
  'youtu.be'
];

// Handler for both GET and POST requests
async function handleRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');
  const debug = searchParams.get('debug') === 'true' || DEBUG;
  const retry = parseInt(searchParams.get('retry') || '0', 10);
  const bypassRewrite = searchParams.get('bypass') === 'true';
  
  if (!targetUrl) {
    return NextResponse.redirect('https://www.google.com');
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const hostname = parsedUrl.hostname;
    
    // Check if we should bypass rewriting for this domain
    const shouldBypassRewrite = bypassRewrite || 
      BYPASS_REWRITE_DOMAINS.some(domain => hostname.includes(domain)) ||
      hostname.endsWith('.poki-gdn.com');
    
    if (debug) {
      console.log(`Proxy request: ${targetUrl} (Retry: ${retry})`);
      console.log(`Bypass rewrite: ${shouldBypassRewrite}`);
      console.log(`Headers: ${JSON.stringify(Object.fromEntries(request.headers))}`);
    }

    // Enhanced browser-like headers
    const headers = new Headers({
      'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36${retry > 0 ? ` Retry/${retry}` : ''}`,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': `https://${parsedUrl.hostname}`,
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1', // Do Not Track
      'Origin': `https://${parsedUrl.hostname}`,
    });

    // Copy over cookies from original request
    const originalCookies = request.headers.get('cookie');
    if (originalCookies) {
      headers.set('Cookie', originalCookies);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000); // Increase timeout to 40s

    const fetchResponse = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'include', // Include credentials for cross-origin requests
    });

    clearTimeout(timeoutId);

    if (debug) {
      console.log(`Response status: ${fetchResponse.status}`);
      console.log(`Response headers: ${JSON.stringify(Object.fromEntries(fetchResponse.headers))}`);
    }

    const contentType = fetchResponse.headers.get('content-type') || '';
    
    // Pass through binary content and responses for domains that should bypass rewriting
    if (!contentType.includes('text/html') || shouldBypassRewrite) {
      const buffer = await fetchResponse.arrayBuffer();
      
      // Create response headers while preserving most from the original response
      const responseHeaders = new Headers();
      
      // Copy all headers from the original response
      fetchResponse.headers.forEach((value, key) => {
        // Skip security-related headers that might block our proxy
        if (!['x-frame-options', 'frame-options', 'content-security-policy', 'x-content-security-policy'].includes(key.toLowerCase())) {
          responseHeaders.set(key, value);
        }
      });
      
      // Set our own headers
      responseHeaders.set('Content-Type', contentType);
      responseHeaders.set('X-Proxy-Status', 'forwarded');
      responseHeaders.set('X-Proxy-Source', targetUrl);
      responseHeaders.set('Cache-Control', 'no-store');
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set('X-Frame-Options', 'ALLOWALL');
      
      return new NextResponse(buffer, {
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: responseHeaders
      });
    }

    // Process HTML content
    const html = await fetchResponse.text();

    if (debug) {
      console.log(`HTML content length: ${html.length}`);
    }

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove all potential blocking elements
    const elementsToRemove = [
      'script[src*="anti-iframe"]',
      'script[src*="security"]',
      'script[src*="bot"]',
      'meta[http-equiv="X-Frame-Options"]',
      'meta[http-equiv="Frame-Options"]',
      'meta[http-equiv="Content-Security-Policy"]',
      'meta[name="robots"]',
    ];

    elementsToRemove.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Make sure we have a base element or add one
    const baseElements = document.querySelectorAll('base');
    let baseHref = '/';
    
    if (baseElements.length > 0) {
      baseHref = baseElements[0].getAttribute('href') || '/';
    } else {
      // Add a base element if none exists
      const baseEl = document.createElement('base');
      baseEl.setAttribute('href', `https://${parsedUrl.hostname}/`);
      const head = document.querySelector('head');
      if (head) {
        head.insertBefore(baseEl, head.firstChild);
      }
    }

    // Helper function to get absolute URL
    const getAbsoluteUrl = (url: string): string => {
      try {
        if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#') || url.startsWith('javascript:')) {
          return url;
        }
        return new URL(url, targetUrl).href;
      } catch (e) {
        if (debug) console.error(`Failed to process URL: ${url}`, e);
        return url;
      }
    };

    // Helper function to determine if a URL should be proxied
    const shouldProxyUrl = (url: string): boolean => {
      if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#') || url.startsWith('javascript:')) {
        return false;
      }
      
      try {
        const urlObj = new URL(url, targetUrl);
        const hostname = urlObj.hostname;
        
        // Check if the domain should bypass proxy
        return !BYPASS_REWRITE_DOMAINS.some(domain => hostname.includes(domain));
      } catch {
        return true;
      }
    };

    // Rewrite ALL resources to go through proxy
    ['img', 'script', 'link', 'a', 'iframe', 'source', 'video', 'audio', 'object', 'embed'].forEach(tagName => {
      document.querySelectorAll(tagName).forEach(el => {
        // Handle src attribute
        if (el.hasAttribute('src')) {
          const src = el.getAttribute('src');
          if (src) {
            const absoluteUrl = getAbsoluteUrl(src);
            if (shouldProxyUrl(absoluteUrl)) {
              el.setAttribute('src', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
            } else if (el.tagName === 'IFRAME') {
              // For iframes of bypassed domains, add the bypass parameter
              el.setAttribute('src', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&bypass=true`);
            }
          }
        }

        // Handle href attribute
        if (el.hasAttribute('href')) {
          const href = el.getAttribute('href');
          if (href && !href.startsWith('javascript:')) {
            const absoluteUrl = getAbsoluteUrl(href);
            if (shouldProxyUrl(absoluteUrl)) {
              el.setAttribute('href', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
            }
          }
        }

        // Handle data attributes that might contain URLs
        ['data-src', 'data-url', 'data-background', 'data-original'].forEach(attr => {
          if (el.hasAttribute(attr)) {
            const value = el.getAttribute(attr);
            if (value) {
              const absoluteUrl = getAbsoluteUrl(value);
              if (shouldProxyUrl(absoluteUrl)) {
                el.setAttribute(attr, `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
              }
            }
          }
        });
        
        // Allow iframe content from any domain
        if (el.tagName === 'IFRAME') {
          el.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation');
          el.removeAttribute('security');
          el.removeAttribute('integrity');
        }
      });
    });

    // Process inline CSS and style attributes (only if not bypassing rewrite)
    document.querySelectorAll('style, [style]').forEach(el => {
      if (el.tagName === 'STYLE') {
        const css = el.textContent || '';
        el.textContent = css.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
          if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
          try {
            const absoluteUrl = getAbsoluteUrl(url);
            if (shouldProxyUrl(absoluteUrl)) {
              return `url("/api/proxy?url=${encodeURIComponent(absoluteUrl)}")`;
            }
            return match;
          } catch (e) {
            if (debug) console.error(`Failed to process CSS URL: ${url}`, e);
            return match;
          }
        });
      } else if (el.hasAttribute('style')) {
        const style = el.getAttribute('style') || '';
        el.setAttribute('style', style.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
          if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
          try {
            const absoluteUrl = getAbsoluteUrl(url);
            if (shouldProxyUrl(absoluteUrl)) {
              return `url("/api/proxy?url=${encodeURIComponent(absoluteUrl)}")`;
            }
            return match;
          } catch (e) {
            if (debug) console.error(`Failed to process style URL: ${url}`, e);
            return match;
          }
        }));
      }
    });

    // Enhanced anti-detection script
    const head = document.querySelector('head');
    if (head) {
      const antiDetectionScript = document.createElement('script');
      antiDetectionScript.textContent = `
        try {
          // Create a secure environment for the iframe content
          // Spoof window properties
          Object.defineProperties(window, {
            'self': { get: () => window.top, configurable: true },
            'top': { get: () => window, configurable: true },
            'parent': { get: () => window, configurable: true },
            'frameElement': { get: () => null, configurable: true },
            'location': { 
              get: () => new URL('${targetUrl}'), 
              set: (url) => { window.location.href = \`/api/proxy?url=\${encodeURIComponent(url)}\`; }, 
              configurable: true 
            }
          });

          // Prevent frame-busting techniques
          if (window.location !== window.parent.location) {
            window.parent.location = window.location;
          }

          // Spoof navigator properties
          const originalNavigator = navigator;
          Object.defineProperty(window, 'navigator', {
            get: () => ({
              ...originalNavigator,
              userAgent: '${headers.get('User-Agent')}',
              platform: 'Win32',
              vendor: 'Google Inc.'
            }),
            configurable: true
          });

          // Prevent bot detection
          window.chrome = window.chrome || { runtime: {}, app: {} };
          window.document.documentMode = undefined;
          
          // Override security-related methods
          const originalCreateElement = document.createElement;
          document.createElement = function() {
            const element = originalCreateElement.apply(this, arguments);
            if (arguments[0].toLowerCase() === 'iframe') {
              setTimeout(() => {
                element.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');
              }, 0);
            }
            return element;
          };
          
          // Override security checks
          Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function() {
              return window;
            }
          });
          
          // Disable Content-Security-Policy
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                  if (node.nodeName === 'META') {
                    const httpEquiv = node.getAttribute('http-equiv');
                    if (httpEquiv && httpEquiv.toLowerCase() === 'content-security-policy') {
                      node.remove();
                    }
                  }
                }
              }
            }
          });
          
          observer.observe(document.documentElement, { 
            childList: true, 
            subtree: true 
          });
        } catch(e) {
          console.warn('Anti-detection setup failed:', e);
        }
      `;
      head.appendChild(antiDetectionScript);
      
      // Add a cookie handling script to preserve login sessions
      const cookieScript = document.createElement('script');
      cookieScript.textContent = `
        try {
          // Intercept cookie operations
          (function() {
            const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
            
            Object.defineProperty(document, 'cookie', {
              get: function() {
                return originalCookie.get.call(this);
              },
              set: function(val) {
                originalCookie.set.call(this, val);
                try {
                  // Store cookies in localStorage to maintain across pages
                  if (val) {
                    const domain = window.location.hostname;
                    let cookies = JSON.parse(localStorage.getItem('proxy_cookies_' + domain) || '{}');
                    const cookieParts = val.split(';')[0].split('=');
                    if (cookieParts.length >= 2) {
                      const name = cookieParts[0].trim();
                      const value = cookieParts.slice(1).join('=').trim();
                      cookies[name] = value;
                      localStorage.setItem('proxy_cookies_' + domain, JSON.stringify(cookies));
                    }
                  }
                } catch (e) {
                  console.warn('Cookie synchronization failed:', e);
                }
                return true;
              },
              configurable: true
            });
          })();
        } catch(e) {
          console.warn('Cookie handling setup failed:', e);
        }
      `;
      head.appendChild(cookieScript);
    }

    // Add a meta tag to disable CSP
    const metaCSP = document.createElement('meta');
    metaCSP.setAttribute('http-equiv', 'Content-Security-Policy');
    metaCSP.setAttribute('content', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
    
    if (head) {
      head.insertBefore(metaCSP, head.firstChild);
    }

    // Add debug information if enabled
    if (debug) {
      const debugDiv = document.createElement('div');
      debugDiv.style.position = 'fixed';
      debugDiv.style.top = '0';
      debugDiv.style.right = '0';
      debugDiv.style.background = 'rgba(0,0,0,0.7)';
      debugDiv.style.color = 'white';
      debugDiv.style.padding = '10px';
      debugDiv.style.zIndex = '9999999';
      debugDiv.textContent = `Proxy Debug: ${new Date().toISOString()} - Source: ${targetUrl}`;
      document.body?.appendChild(debugDiv);
    }

    const processedHtml = dom.serialize();

    // Create response headers
    const responseHeaders = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'X-Proxy-Status': 'success',
      'X-Proxy-Source': targetUrl,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'X-Frame-Options': 'ALLOWALL'
    });

    // Copy cookies from the original response
    // Standard way to handle Set-Cookie headers in Next.js
    const setCookieHeader = fetchResponse.headers.get('set-cookie');
    
    if (setCookieHeader) {
      // Split multiple cookies if present (they may be comma or newline separated)
      const cookies = setCookieHeader.split(/,(?=\s*[^,;]+=[^,;]+)/);
      
      cookies.forEach(cookie => {
        responseHeaders.append('Set-Cookie', cookie.trim());
      });
    }

    return new NextResponse(processedHtml, {
      status: 200,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('Proxy error details:', error);

    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Proxy Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; text-align: center; background: #f8f9fa; }
            .error-container { max-width: 800px; margin: 50px auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; }
            h1 { color: #e74c3c; }
            .details { text-align: left; background: #f1f1f1; padding: 15px; border-radius: 5px; margin-top: 20px; overflow: auto; }
            .url { font-family: monospace; word-break: break-all; }
            .retry-options { margin-top: 20px; display: flex; justify-content: center; gap: 10px; }
            button { padding: 10px 15px; border: none; border-radius: 5px; background: #3498db; color: white; cursor: pointer; }
            button:hover { background: #2980b9; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Proxy Connection Error</h1>
            <p>Sorry, we couldn't connect to the requested website.</p>
            <p>URL: <span class="url">${targetUrl}</span></p>
            <div class="details">
              <h3>Error Details:</h3>
              <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
              ${error instanceof Error && error.stack ? `<pre>${error.stack}</pre>` : ''}
            </div>
            <div class="retry-options">
              <button onclick="window.location.reload()">Retry</button>
              <button onclick="window.location.href='/api/proxy?url=${encodeURIComponent(targetUrl)}&retry=${retry + 1}'">Retry with Fallback</button>
              <button onclick="window.location.href='/api/proxy?url=${encodeURIComponent(targetUrl)}&bypass=true'">Bypass Content Rewriting</button>
              <button onclick="window.history.back()">Go Back</button>
            </div>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
        'X-Proxy-Status': 'error',
        'X-Proxy-Error': error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}