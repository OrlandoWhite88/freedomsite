import { NextRequest, NextResponse } from 'next/server';
import { URL } from 'url';
import { JSDOM } from 'jsdom';

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

    if (debug) {
      console.log(`Proxying: ${targetUrl}`);
    }

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
      'TE': 'trailers',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const fetchResponse = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (debug) {
      console.log(`Response status for ${targetUrl}: ${fetchResponse.status}`);
    }

    const contentType = fetchResponse.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      const html = await fetchResponse.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Remove blocking elements (unchanged)
      const elementsToRemove = [
        'script[src*="anti-iframe"]',
        'script[src*="security"]',
        'meta[http-equiv="X-Frame-Options"]',
        'meta[http-equiv="Frame-Options"]',
        'meta[http-equiv="Content-Security-Policy"]',
      ];
      elementsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
      });

      // Rewrite URLs (unchanged)
      ['img', 'script', 'link', 'a', 'iframe', 'source'].forEach(tagName => {
        document.querySelectorAll(tagName).forEach(el => {
          if (el.hasAttribute('src')) {
            const src = el.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.startsWith('blob:') && !src.startsWith('#')) {
              const absoluteUrl = new URL(src, targetUrl).href;
              el.setAttribute('src', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
            }
          }
          if (el.hasAttribute('href')) {
            const href = el.getAttribute('href');
            if (href && !href.startsWith('data:') && !href.startsWith('blob:') && !href.startsWith('#') && !href.startsWith('javascript:')) {
              const absoluteUrl = new URL(href, targetUrl).href;
              el.setAttribute('href', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
            }
          }
        });
      });

      // Process CSS URLs (unchanged)
      document.querySelectorAll('style').forEach(styleEl => {
        const css = styleEl.textContent || '';
        const processedCss = css.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
          if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
          const absoluteUrl = new URL(url, targetUrl).href;
          return `url("/api/proxy?url=${encodeURIComponent(absoluteUrl)}")`;
        });
        styleEl.textContent = processedCss;
      });

      // Inject scripts into head
      const head = document.querySelector('head');
      if (head) {
        // Anti-detection script (unchanged)
        const antiDetectionScript = document.createElement('script');
        antiDetectionScript.textContent = `
          // Override frame detection
          try {
            Object.defineProperty(window, 'self', { get: function() { return window.top; } });
            Object.defineProperty(window, 'top', { get: function() { return window; } });
            Object.defineProperty(window, 'parent', { get: function() { return window; } });
            Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
            if (window.location !== window.parent.location) {
              window.parent.location = window.location;
            }
          } catch(e) {
            console.warn('Frame protection override failed:', e);
          }
        `;
        head.appendChild(antiDetectionScript);

        // Fetch override script (new)
        const fetchOverrideScript = document.createElement('script');
        fetchOverrideScript.textContent = `
          (function() {
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              if (typeof input === 'string' && !input.startsWith('/api/proxy')) {
                const url = new URL(input, window.location.origin).href;
                const proxyUrl = '/api/proxy?url=' + encodeURIComponent(url);
                return originalFetch(proxyUrl, init);
              }
              return originalFetch(input, init);
            };
          })();
        `;
        head.appendChild(fetchOverrideScript);
      }

      // Debug div (unchanged)
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

      const processedHtml = dom.serialize();

      return new NextResponse(processedHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Proxy-Status': 'success',
          'X-Proxy-Source': targetUrl,
        },
      });
    } else {
      const buffer = await fetchResponse.arrayBuffer();
      const headers = new Headers(fetchResponse.headers);
      if (
        contentType.startsWith('image/') ||
        contentType === 'application/javascript' ||
        contentType === 'text/css' ||
        contentType === 'font/' ||
        contentType.startsWith('video/') ||
        contentType.startsWith('audio/')
      ) {
        headers.set('Cache-Control', 'public, max-age=3600');
      } else {
        headers.set('Cache-Control', 'no-cache');
      }
      return new NextResponse(buffer, {
        status: fetchResponse.status,
        headers: headers,
      });
    }
  } catch (error) {
    // Error handling (unchanged)
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
        'X-Proxy-Error': error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}