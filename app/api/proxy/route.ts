import { NextRequest, NextResponse } from 'next/server';
import { URL } from 'url';
import { JSDOM } from 'jsdom';  // You'll need to install this with: npm install jsdom

// Debug mode to help diagnose issues
const DEBUG = true;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');
  const debug = searchParams.get('debug') === 'true' || DEBUG;
  
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
      console.log(`Proxy request: ${targetUrl}`);
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
    
    // Attempt to fetch the target URL using fetch API with a 30s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const fetchResponse = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Log response details if debugging
    if (debug) {
      console.log(`Response status: ${fetchResponse.status}`);
      console.log(`Response headers: ${JSON.stringify(Object.fromEntries(fetchResponse.headers))}`);
    }
    
    // Get content type
    const contentType = fetchResponse.headers.get('content-type') || '';
    
    // Handle different content types
    if (contentType.includes('text/html')) {
      // Get HTML content
      const html = await fetchResponse.text();
      
      if (debug) {
        console.log(`HTML content length: ${html.length}`);
      }
      
      // Process HTML using JSDOM for more robust handling
      const dom = new JSDOM(html);
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
      ['img', 'script', 'link', 'a', 'iframe', 'source'].forEach(tagName => {
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
      
      // Inject anti-detection script
      const head = document.querySelector('head');
      if (head) {
        const antiDetectionScript = document.createElement('script');
        antiDetectionScript.textContent = `
          // Override frame detection
          try {
            Object.defineProperty(window, 'self', { get: function() { return window.top; } });
            Object.defineProperty(window, 'top', { get: function() { return window; } });
            Object.defineProperty(window, 'parent', { get: function() { return window; } });
            Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
            
            // Override frame-busting checks
            if (window.location !== window.parent.location) {
              window.parent.location = window.location;
            }
          } catch(e) {
            console.warn('Frame protection override failed:', e);
          }
        `;
        head.appendChild(antiDetectionScript);
      }
      
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
        debugDiv.textContent = `Proxy Debug: ${new Date().toISOString()} - Source: ${targetUrl}`;
        document.body.appendChild(debugDiv);
      }
      
      // Get the full HTML
      const processedHtml = dom.serialize();
      
      // Return the processed HTML
      return new NextResponse(processedHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Proxy-Status': 'success',
          'X-Proxy-Source': targetUrl
        }
      });
    } else {
      // For non-HTML content, just forward it directly
      const buffer = await fetchResponse.arrayBuffer();
      
      return new NextResponse(buffer, {
        status: fetchResponse.status,
        headers: {
          'Content-Type': contentType,
          'X-Proxy-Status': 'forwarded',
          'X-Proxy-Source': targetUrl
        }
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
            .details { text-align: left; background: #f1f1f1; padding: 15px; border-radius: 5px; margin-top: 20px; overflow: auto; }
            .url { font-family: monospace; word-break: break-all; }
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
            
            <p>Try refreshing the page or selecting a different service.</p>
            <button onclick="window.location.reload()">Refresh</button>
            <button onclick="window.history.back()">Go Back</button>
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