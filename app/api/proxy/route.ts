import { NextRequest, NextResponse } from 'next/server';
import { URL } from 'url';
import { JSDOM } from 'jsdom';

// Debug mode to help diagnose issues
const DEBUG = true;

// Support all HTTP methods, not just GET
export async function GET(request: NextRequest) {
  return handleProxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return handleProxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return handleProxyRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return handleProxyRequest(request, 'PATCH');
}

export async function OPTIONS(request: NextRequest) {
  // Handle OPTIONS requests for CORS preflight
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

// Main proxy handler that supports all methods
async function handleProxyRequest(request: NextRequest, method: string) {
  const url = new URL(request.url);
  let targetUrl = url.searchParams.get('url');
  const debug = url.searchParams.get('debug') === 'true' || DEBUG;
  const bypassRewrite = url.searchParams.get('bypass') === 'true';
  
  if (!targetUrl) {
    return NextResponse.redirect('https://www.google.com');
  }
  
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    const parsedUrl = new URL(targetUrl);
    
    // Log request details if debugging
    if (debug) {
      console.log(`Proxy ${method} request: ${targetUrl}`);
      console.log(`Headers: ${JSON.stringify(Object.fromEntries(request.headers))}`);
    }
    
    // Custom headers to mimic a real browser
    const headers = new Headers({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': `https://${parsedUrl.hostname}`,
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Cache-Control': 'max-age=0',
      'TE': 'trailers'
    });
    
    // Forward cookies from the client to the target site
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader);
    }
    
    // Prepare request options
    const fetchOptions: RequestInit = {
      method,
      headers,
      redirect: 'follow',
    };
    
    // Handle request body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      // Get content type from the request
      const contentType = request.headers.get('content-type') || '';
      
      // Handle different types of POST data
      if (contentType.includes('application/json')) {
        const jsonData = await request.json();
        fetchOptions.body = JSON.stringify(jsonData);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        const params = new URLSearchParams();
        
        // Convert FormData to URLSearchParams
        for (const [key, value] of formData.entries()) {
          params.append(key, value.toString());
        }
        
        fetchOptions.body = params.toString();
      } else if (contentType.includes('multipart/form-data')) {
        // For multipart/form-data, we need to rebuild the FormData
        const formData = await request.formData();
        fetchOptions.body = formData;
      } else {
        // For other content types, pass the raw body
        fetchOptions.body = await request.text();
      }
    }
    
    // Attempt to fetch the target URL using fetch API with a 30s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    fetchOptions.signal = controller.signal;
    
    const fetchResponse = await fetch(targetUrl, fetchOptions);
    
    clearTimeout(timeoutId);
    
    // Log response details if debugging
    if (debug) {
      console.log(`Response status: ${fetchResponse.status}`);
      console.log(`Response headers: ${JSON.stringify(Object.fromEntries(fetchResponse.headers))}`);
    }
    
    // Get content type
    const contentType = fetchResponse.headers.get('content-type') || '';
    
    // Prepare response headers
    const responseHeaders = new Headers({
      'X-Proxy-Status': 'success',
      'X-Proxy-Source': targetUrl,
      'X-Frame-Options': 'SAMEORIGIN', // Override X-Frame-Options
    });
    
    // Forward cookies from the target site to the client
    const setCookieHeaders = fetchResponse.headers.getAll ? 
      fetchResponse.headers.getAll('set-cookie') : 
      fetchResponse.headers.get('set-cookie');
    
    if (setCookieHeaders) {
      if (Array.isArray(setCookieHeaders)) {
        setCookieHeaders.forEach(cookie => {
          responseHeaders.append('Set-Cookie', cookie);
        });
      } else if (setCookieHeaders) {
        responseHeaders.set('Set-Cookie', setCookieHeaders);
      }
    }
    
    // Copy content type
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }
    
    // Handle redirects
    if (fetchResponse.redirected) {
      const redirectUrl = fetchResponse.url;
      return NextResponse.redirect(`/api/proxy?url=${encodeURIComponent(redirectUrl)}`);
    }
    
    // Handle HTML content - rewrite links and inject scripts
    if (contentType.includes('text/html') && !bypassRewrite) {
      // Get HTML content
      const html = await fetchResponse.text();
      
      if (debug) {
        console.log(`HTML content length: ${html.length}`);
      }
      
      // Process HTML using JSDOM for more robust handling
      const dom = new JSDOM(html, { 
        url: targetUrl,
        referrer: request.headers.get('referer') || targetUrl,
        contentType: contentType
      });
      
      const document = dom.window.document;
      
      // Remove elements that could block embedding
      const elementsToRemove = [
        'script[src*="anti-iframe"]',
        'script[src*="security"]',
        'meta[http-equiv="X-Frame-Options"]',
        'meta[http-equiv="Frame-Options"]',
        'meta[http-equiv="Content-Security-Policy"]'
      ];
      
      elementsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
      });
      
      // Process all links and resources for proxying
      const baseElements = document.querySelectorAll('base');
      const baseHref = baseElements.length > 0 ? baseElements[0].getAttribute('href') : '/';
      const basePath = baseHref || '/';
      
      // Rewrite all assets to go through our proxy
      // Process all img, script, link, and anchor tags
      ['img', 'script', 'link', 'a', 'iframe', 'source', 'video', 'audio', 'embed', 'object'].forEach(tagName => {
        document.querySelectorAll(tagName).forEach(el => {
          // Handle src attribute
          if (el.hasAttribute('src')) {
            const src = el.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.startsWith('blob:') && !src.startsWith('#')) {
              try {
                const absoluteUrl = new URL(src, targetUrl).href;
                el.setAttribute('src', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
              } catch (e) {
                if (debug) console.error(`Failed to process src: ${src}`, e);
              }
            }
          }
          
          // Handle srcset attribute (for responsive images)
          if (el.hasAttribute('srcset')) {
            const srcset = el.getAttribute('srcset');
            if (srcset) {
              try {
                // Parse and rewrite each URL in the srcset
                const newSrcset = srcset.split(',').map(srcsetPart => {
                  const [url, descriptor] = srcsetPart.trim().split(/\s+/);
                  if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
                    const absoluteUrl = new URL(url, targetUrl).href;
                    return `/api/proxy?url=${encodeURIComponent(absoluteUrl)} ${descriptor || ''}`;
                  }
                  return srcsetPart;
                }).join(', ');
                
                el.setAttribute('srcset', newSrcset);
              } catch (e) {
                if (debug) console.error(`Failed to process srcset: ${srcset}`, e);
              }
            }
          }
          
          // Handle href attribute
          if (el.hasAttribute('href')) {
            const href = el.getAttribute('href');
            if (href && !href.startsWith('data:') && !href.startsWith('blob:') && !href.startsWith('#') && !href.startsWith('javascript:')) {
              try {
                const absoluteUrl = new URL(href, targetUrl).href;
                el.setAttribute('href', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
              } catch (e) {
                if (debug) console.error(`Failed to process href: ${href}`, e);
              }
            }
          }
          
          // Handle data-src attribute (lazy loading)
          if (el.hasAttribute('data-src')) {
            const dataSrc = el.getAttribute('data-src');
            if (dataSrc && !dataSrc.startsWith('data:') && !dataSrc.startsWith('blob:')) {
              try {
                const absoluteUrl = new URL(dataSrc, targetUrl).href;
                el.setAttribute('data-src', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
              } catch (e) {
                if (debug) console.error(`Failed to process data-src: ${dataSrc}`, e);
              }
            }
          }
          
          // Handle poster attribute (for video)
          if (el.hasAttribute('poster')) {
            const poster = el.getAttribute('poster');
            if (poster && !poster.startsWith('data:') && !poster.startsWith('blob:')) {
              try {
                const absoluteUrl = new URL(poster, targetUrl).href;
                el.setAttribute('poster', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
              } catch (e) {
                if (debug) console.error(`Failed to process poster: ${poster}`, e);
              }
            }
          }
        });
      });
      
      // Process all CSS rules in style tags
      document.querySelectorAll('style').forEach(styleEl => {
        const css = styleEl.textContent || '';
        const processedCss = css.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
          if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
          try {
            const absoluteUrl = new URL(url, targetUrl).href;
            return `url("/api/proxy?url=${encodeURIComponent(absoluteUrl)}")`;
          } catch (e) {
            if (debug) console.error(`Failed to process CSS URL: ${url}`, e);
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
            return `url("/api/proxy?url=${encodeURIComponent(absoluteUrl)}")`;
          } catch (e) {
            if (debug) console.error(`Failed to process inline style URL: ${url}`, e);
            return match;
          }
        });
        el.setAttribute('style', processedStyle);
      });
      
      // Inject sophisticated scripts for handling navigation, form submission, and more
      const head = document.querySelector('head');
      if (head) {
        // Add base tag to ensure relative URLs resolve correctly
        let baseTag = document.querySelector('base');
        if (!baseTag) {
          baseTag = document.createElement('base');
          baseTag.setAttribute('href', targetUrl);
          head.insertBefore(baseTag, head.firstChild);
        } else {
          // If base tag exists, update it
          const baseHref = baseTag.getAttribute('href');
          if (baseHref) {
            const absoluteBaseUrl = new URL(baseHref, targetUrl).href;
            baseTag.setAttribute('href', absoluteBaseUrl);
          } else {
            baseTag.setAttribute('href', targetUrl);
          }
        }

        // Anti-detection and navigation interception script
        const interceptScript = document.createElement('script');
        interceptScript.textContent = `
          (function() {
            // Override frame detection
            try {
              Object.defineProperty(window, 'self', { get: function() { return window.top; } });
              Object.defineProperty(window, 'top', { get: function() { return window; } });
              Object.defineProperty(window, 'parent', { get: function() { return window; } });
              Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
              
              // Disable frame-busting checks
              window.frameElement = null;
              window.sameOrigin = true;
              
              // Override security-related checks
              window.isSecureContext = true;
            } catch(e) {
              console.warn('Frame protection override failed:', e);
            }
            
            // Intercept form submissions
            document.addEventListener('submit', function(e) {
              const form = e.target;
              if (form && form.tagName === 'FORM') {
                e.preventDefault();
                
                // Get form action
                let action = form.action || window.location.href;
                const method = (form.method || 'GET').toUpperCase();
                
                // Prepare form data
                const formData = new FormData(form);
                
                if (method === 'GET') {
                  // For GET, append form data to URL
                  const url = new URL(action);
                  for (const [key, value] of formData.entries()) {
                    url.searchParams.append(key, value);
                  }
                  action = url.toString();
                  
                  // Navigate to the proxied URL
                  window.location.href = '/api/proxy?url=' + encodeURIComponent(action);
                } else {
                  // For POST and other methods, submit via fetch
                  fetch('/api/proxy?url=' + encodeURIComponent(action), {
                    method: method,
                    body: formData,
                    headers: {
                      'X-Requested-With': 'XMLHttpRequest'
                    }
                  })
                  .then(response => response.text())
                  .then(html => {
                    // Replace the current page with the response
                    document.open();
                    document.write(html);
                    document.close();
                    // Update history to make back button work
                    history.pushState({}, '', '/api/proxy?url=' + encodeURIComponent(action));
                  })
                  .catch(error => {
                    console.error('Form submission error:', error);
                    alert('Error submitting form: ' + error.message);
                  });
                }
              }
            }, true);
            
            // Intercept clicks on links
            document.addEventListener('click', function(e) {
              // Find the closest anchor tag
              let target = e.target;
              while (target && target.tagName !== 'A') {
                target = target.parentElement;
                if (!target) break;
              }
              
              if (target && target.tagName === 'A') {
                const href = target.getAttribute('href');
                
                // Skip special links
                if (!href || href.startsWith('#') || 
                    href.startsWith('javascript:') || 
                    href.startsWith('mailto:') || 
                    href.startsWith('tel:')) {
                  return;
                }
                
                // Check if the link is already proxied
                if (!href.startsWith('/api/proxy')) {
                  e.preventDefault();
                  
                  try {
                    // Create an absolute URL
                    const baseHref = document.querySelector('base')?.getAttribute('href') || window.location.href;
                    const absoluteUrl = new URL(href, baseHref).href;
                    
                    // Navigate to the proxied URL
                    window.location.href = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                  } catch (error) {
                    console.error('Error processing link:', error);
                  }
                }
              }
            }, true);
            
            // Intercept History API
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            history.pushState = function() {
              const url = arguments[2];
              if (url && typeof url === 'string' && !url.startsWith('/api/proxy')) {
                try {
                  const absoluteUrl = new URL(url, window.location.href).href;
                  arguments[2] = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                } catch (e) {
                  console.error('Failed to process pushState URL:', url, e);
                }
              }
              return originalPushState.apply(this, arguments);
            };
            
            history.replaceState = function() {
              const url = arguments[2];
              if (url && typeof url === 'string' && !url.startsWith('/api/proxy')) {
                try {
                  const absoluteUrl = new URL(url, window.location.href).href;
                  arguments[2] = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                } catch (e) {
                  console.error('Failed to process replaceState URL:', url, e);
                }
              }
              return originalReplaceState.apply(this, arguments);
            };
            
            // Intercept fetch and XMLHttpRequest
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              if (typeof input === 'string' && !input.startsWith('/api/proxy')) {
                try {
                  const absoluteUrl = new URL(input, window.location.href).href;
                  input = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                } catch (e) {
                  console.error('Failed to process fetch URL:', input, e);
                }
              }
              return originalFetch.call(this, input, init);
            };
            
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
              if (typeof url === 'string' && !url.startsWith('/api/proxy')) {
                try {
                  const absoluteUrl = new URL(url, window.location.href).href;
                  url = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                } catch (e) {
                  console.error('Failed to process XHR URL:', url, e);
                }
              }
              return originalXhrOpen.call(this, method, url, ...args);
            };
            
            console.log('[Proxy] Navigation interception enabled');
          })();
        `;
        head.appendChild(interceptScript);
      }
      
      // Fix issues with nested iframes
      document.querySelectorAll('iframe').forEach(iframe => {
        // Set sandbox attribute to allow scripts but maintain security
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation');
        
        // Add loading="lazy" to improve performance
        iframe.setAttribute('loading', 'lazy');
      });
      
      // Add debug info if needed
      if (debug) {
        const debugDiv = document.createElement('div');
        debugDiv.style.position = 'fixed';
        debugDiv.style.top = '0';
        debugDiv.style.right = '0';
        debugDiv.style.background = 'rgba(0,0,0,0.7)';
        debugDiv.style.color = 'white';
        debugDiv.style.padding = '10px';
        debugDiv.style.zIndex = '9999999';
        debugDiv.style.fontSize = '12px';
        debugDiv.textContent = `Proxy Debug: ${new Date().toISOString()} - Source: ${targetUrl}`;
        document.body.appendChild(debugDiv);
      }
      
      // Get the full HTML
      const processedHtml = dom.serialize();
      
      // Return the processed HTML
      return new NextResponse(processedHtml, {
        status: 200,
        headers: responseHeaders,
      });
    } else {
      // For non-HTML content, just forward it directly
      const buffer = await fetchResponse.arrayBuffer();
      
      return new NextResponse(buffer, {
        status: fetchResponse.status,
        headers: responseHeaders,
      });
    }
  } catch (error) {
    console.error('Proxy error details:', error);
    
    // Return a detailed error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Proxy Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; text-align: center; background: #f8f9fa; }
            .error-container { max-width: 800px; margin: 50px auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; }
            h1 { color: #e74c3c; }
            .details { text-align: left; background: #f1f1f1; padding: 15px; border-radius: 5px; margin-top: 20px; overflow: auto; max-height: 300px; }
            .url { font-family: monospace; word-break: break-all; }
            .actions { margin-top: 20px; }
            button { padding: 8px 16px; margin: 0 5px; cursor: pointer; border-radius: 4px; border: none; }
            .refresh { background: #3498db; color: white; }
            .back { background: #7f8c8d; color: white; }
            .bypass { background: #2ecc71; color: white; }
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
            
            <div class="actions">
              <button class="refresh" onclick="window.location.reload()">Refresh</button>
              <button class="back" onclick="window.history.back()">Go Back</button>
              <button class="bypass" onclick="window.location.href='/api/proxy?url=${encodeURIComponent(targetUrl)}&bypass=true'">Try Bypass Mode</button>
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
        'X-Proxy-Error': error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}