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
  // Use the URL from the request object
  const url = request.nextUrl;
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
    
    // Prepare request options
    const fetchOptions: RequestInit = {
      method,
      headers,
      redirect: 'follow',
    };
    
    // Handle request body for POST/PUT/PATCH - simplified for now
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        // For simplicity, just forward the text content
        const bodyText = await request.text();
        if (bodyText) {
          fetchOptions.body = bodyText;
          
          // Preserve content-type header if it exists
          const contentType = request.headers.get('content-type');
          if (contentType) {
            headers.set('Content-Type', contentType);
          }
        }
      } catch (e) {
        console.error('Error processing request body:', e);
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
    
    // Copy content type
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }
    
    // Handle redirects - need absolute URL for Next.js
    if (fetchResponse.redirected) {
      const redirectUrl = fetchResponse.url;
      
      try {
        // Use the request URL to build an absolute URL for the redirect
        const requestUrl = request.url;
        const requestUrlObj = new URL(requestUrl);
        const absoluteRedirectUrl = new URL(`/api/proxy?url=${encodeURIComponent(redirectUrl)}`, requestUrlObj.origin).toString();
        
        // Create a NextResponse with the appropriate status and headers
        const response = new NextResponse(null, {
          status: 302, // Found/Temporary redirect
          headers: {
            'Location': absoluteRedirectUrl
          }
        });
        
        return response;
      } catch (error) {
        console.error("Error creating redirect:", error);
        
        // Fallback to a simple HTML redirect if URL construction fails
        const redirectHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta http-equiv="refresh" content="0;url=/api/proxy?url=${encodeURIComponent(redirectUrl)}">
              <title>Redirecting...</title>
            </head>
            <body>
              <p>Redirecting to ${redirectUrl}...</p>
              <p><a href="/api/proxy?url=${encodeURIComponent(redirectUrl)}">Click here if you are not redirected</a></p>
              <script>window.location.href = "/api/proxy?url=${encodeURIComponent(redirectUrl)}";</script>
            </body>
          </html>
        `;
        
        return new NextResponse(redirectHtml, {
          status: 200,
          headers: {
            'Content-Type': 'text/html'
          }
        });
      }
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
        // Special handling for Poki and other game sites
        if (targetUrl.includes('poki.com') || targetUrl.includes('game')) {
          // Add extra script for game sites that use nested iframes
          const gameScript = document.createElement('script');
          gameScript.textContent = `
            // Monitor for dynamically added iframes and fix their src attributes
            const observeIframes = new MutationObserver(function(mutations) {
              mutations.forEach(function(mutation) {
                if (mutation.addedNodes) {
                  mutation.addedNodes.forEach(function(node) {
                    // Process any new iframes
                    if (node.tagName === 'IFRAME') {
                      fixIframe(node);
                    }
                    
                    // Check for iframes inside the added node
                    if (node.querySelectorAll) {
                      node.querySelectorAll('iframe').forEach(fixIframe);
                    }
                  });
                }
              });
            });
            
            function fixIframe(iframe) {
              const src = iframe.getAttribute('src');
              if (src && !src.startsWith('/api/proxy') && !src.startsWith('data:') && !src.startsWith('blob:')) {
                try {
                  const absoluteUrl = new URL(src, window.location.href).href;
                  iframe.setAttribute('src', '/api/proxy?url=' + encodeURIComponent(absoluteUrl));
                  
                  // Set important attributes for game iframes
                  iframe.setAttribute('allowfullscreen', 'true');
                  iframe.setAttribute('allow', 'autoplay; fullscreen; microphone; camera; midi; monetization; xr-spatial-tracking; gamepad');
                  iframe.setAttribute('sandbox', 'allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts');
                } catch (e) {
                  console.error('Failed to fix iframe src:', src, e);
                }
              }
            }
            
            // Start observing the document for added iframes
            observeIframes.observe(document.documentElement, {
              childList: true,
              subtree: true
            });
            
            // Fix existing iframes
            document.querySelectorAll('iframe').forEach(fixIframe);
          `;
          
          head.appendChild(gameScript);
        }
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

        // Enhanced anti-detection script
        const interceptScript = document.createElement('script');
        interceptScript.textContent = `
          (function() {
            // More comprehensive frame detection bypass
            try {
              // Override frame detection properties
              Object.defineProperty(window, 'self', { 
                get: function() { return window.top; } 
              });
              Object.defineProperty(window, 'top', { 
                get: function() { return window; } 
              });
              Object.defineProperty(window, 'parent', { 
                get: function() { return window; } 
              });
              Object.defineProperty(window, 'frameElement', { 
                get: function() { return null; } 
              });
              
              // Disable frame-busting functions
              window.frameElement = null;
              window.self = window.top = window;
              
              // Block common frame-busters
              if (window.location !== window.parent.location) {
                window.parent.location = window.location = () => {};
              }
              
              // Override window.open to keep everything in our proxy
              const originalWindowOpen = window.open;
              window.open = function(url, target, features) {
                if (!url) return originalWindowOpen.call(this, url, target, features);
                
                // Try to keep the window open call within our proxy
                try {
                  // Create absolute URL if needed
                  let absoluteUrl;
                  try {
                    absoluteUrl = new URL(url, window.location.href).href;
                  } catch(e) {
                    absoluteUrl = url;
                  }
                  
                  // If it's an external URL, proxy it
                  if (!absoluteUrl.includes('/api/proxy')) {
                    const proxyUrl = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                    
                    // If target is _blank, we'll still open in a new tab but via proxy
                    if (target === '_blank') {
                      return originalWindowOpen.call(this, proxyUrl, target, features);
                    } else {
                      // For same window, just navigate
                      window.location.href = proxyUrl;
                      return null;
                    }
                  }
                } catch(e) {
                  console.error('Error intercepting window.open:', e);
                }
                
                // Fallback to original
                return originalWindowOpen.call(this, url, target, features);
              };
            } catch(e) {
              console.warn('Frame protection override failed:', e);
            }
            
            // Basic form submission handler
            document.addEventListener('submit', function(e) {
              const form = e.target;
              if (form && form.tagName === 'FORM') {
                const formAction = form.action || window.location.href;
                
                // Only intercept if not already proxied
                if (!formAction.includes('/api/proxy')) {
                  e.preventDefault();
                  
                  // Get method and create action URL
                  const method = (form.method || 'GET').toUpperCase();
                  const actionUrl = '/api/proxy?url=' + encodeURIComponent(formAction);
                  
                  // For GET forms, redirect with form data in URL
                  if (method === 'GET') {
                    const formData = new FormData(form);
                    const params = new URLSearchParams();
                    
                    for (const [key, value] of formData.entries()) {
                      params.append(key, value.toString());
                    }
                    
                    let fullUrl = formAction;
                    if (fullUrl.includes('?')) {
                      fullUrl += '&' + params.toString();
                    } else {
                      fullUrl += '?' + params.toString();
                    }
                    
                    window.location.href = '/api/proxy?url=' + encodeURIComponent(fullUrl);
                  } else {
                    // For POST forms, create a new form that posts to our proxy
                    const newForm = document.createElement('form');
                    newForm.method = method;
                    newForm.action = actionUrl;
                    
                    // Copy all form fields
                    const formData = new FormData(form);
                    for (const [name, value] of formData.entries()) {
                      const input = document.createElement('input');
                      input.type = 'hidden';
                      input.name = name;
                      input.value = value.toString();
                      newForm.appendChild(input);
                    }
                    
                    // Add the form to the page and submit it
                    document.body.appendChild(newForm);
                    newForm.submit();
                  }
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
                    href.startsWith('tel:') ||
                    href.includes('/api/proxy')) {
                  return;
                }
                
                e.preventDefault();
                
                try {
                  // Create an absolute URL
                  const url = new URL(href, window.location.href).href;
                  
                  // Navigate to the proxied URL
                  window.location.href = '/api/proxy?url=' + encodeURIComponent(url);
                } catch (error) {
                  console.error('Error processing link:', error);
                }
              }
            }, true);
          })();
        `;
        head.appendChild(interceptScript);
      }
      
      // Fix issues with nested iframes and enhance for games
      document.querySelectorAll('iframe').forEach(iframe => {
        // Set more permissive sandbox attribute for games and videos
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-orientation-lock allow-pointer-lock');
        
        // Enhanced permissions for games
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('allow', 'autoplay; fullscreen; microphone; camera; midi; xr-spatial-tracking; gamepad');
        
        // Add loading="lazy" to improve performance for non-visible iframes
        iframe.setAttribute('loading', 'lazy');
        
        // For Poki games, add special handling
        const src = iframe.getAttribute('src') || '';
        if (targetUrl.includes('poki.com') || src.includes('game')) {
          // Apply additional settings specific for game iframes
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          iframe.style.position = 'absolute';
          
          // Set allowfullscreen to true
          iframe.setAttribute('allowfullscreen', 'true');
          
          // More permissive sandbox for games
          iframe.setAttribute('sandbox', 'allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts');
        }
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