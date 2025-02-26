import { NextRequest, NextResponse } from 'next/server';
import { URL } from 'url';
import { JSDOM } from 'jsdom';  // Make sure to install with npm install jsdom

// Simple in-memory cache for static assets
const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_MAX_SIZE = 100; // Maximum number of entries to prevent memory issues

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');
  
  if (!targetUrl) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }
  
  // Make sure the URL has a protocol
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    const parsedUrl = new URL(targetUrl);
    
    // For resource files that don't need HTML processing, check the cache
    const isStaticResource = /\.(jpg|jpeg|png|gif|svg|webp|css|js|woff|woff2|ttf|eot|mp3|mp4|webm|ogg|pdf|json)$/i.test(parsedUrl.pathname);
    
    if (isStaticResource) {
      // Check if we have a cached response
      const cacheKey = targetUrl;
      const cachedResponse = CACHE.get(cacheKey);
      
      if (cachedResponse && cachedResponse.timestamp > Date.now() - CACHE_TTL) {
        // Return cached response
        return new NextResponse(cachedResponse.data, {
          status: 200,
          headers: {
            'Content-Type': cachedResponse.contentType,
            'X-Proxy-Cache': 'HIT',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }
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
      'Cache-Control': 'max-age=0'
    });
    
    // Attempt to fetch the target URL using fetch API with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for better performance
    
    const fetchResponse = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Get content type
    const contentType = fetchResponse.headers.get('content-type') || '';
    
    // Fast path for non-HTML content (images, css, js, etc.)
    if (!contentType.includes('text/html')) {
      const buffer = await fetchResponse.arrayBuffer();
      const bufferData = Buffer.from(buffer);
      
      // Cache the response if it's a static resource
      if (isStaticResource && buffer.byteLength < 5 * 1024 * 1024) { // Only cache files under 5MB
        // Clean up cache if it's getting too large
        if (CACHE.size >= CACHE_MAX_SIZE) {
          // Remove the oldest entries
          const entries = Array.from(CACHE.entries());
          const oldestEntries = entries
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, Math.floor(CACHE_MAX_SIZE / 5)); // Remove 20% of oldest entries
          
          oldestEntries.forEach(([key]) => CACHE.delete(key));
        }
        
        // Add to cache
        CACHE.set(targetUrl, {
          data: bufferData,
          contentType,
          timestamp: Date.now()
        });
      }
      
      return new NextResponse(bufferData, {
        status: fetchResponse.status,
        headers: {
          'Content-Type': contentType,
          'X-Proxy-Status': 'direct',
          'Cache-Control': 'public, max-age=300' // 5 minutes caching
        }
      });
    }
    
    // Process HTML content - this is the most resource-intensive part
    const html = await fetchResponse.text();
    
    // Use JSDOM for fast and efficient HTML parsing
    const dom = new JSDOM(html, {
      url: targetUrl,
      contentType: contentType,
      runScripts: "dangerously", // Allow scripts to run - necessary for dynamic sites
      resources: "usable" // Allow resources to load
    });
    
    const document = dom.window.document;
    
    // Function to convert relative URLs to absolute for proxying
    function createProxyUrl(originalUrl, baseUrl) {
      try {
        // Skip data URLs and javascript URLs
        if (!originalUrl || originalUrl.startsWith('data:') || originalUrl.startsWith('javascript:') || originalUrl.startsWith('#')) {
          return originalUrl;
        }
        
        // Convert to absolute URL
        const absoluteUrl = new URL(originalUrl, baseUrl).href;
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
      } catch (e) {
        console.error('URL processing error:', e);
        return originalUrl;
      }
    }
    
    // Process all elements with src, href, or srcset attributes
    ['src', 'href', 'srcset', 'data-src', 'data-href'].forEach(attr => {
      const elements = document.querySelectorAll(`[${attr}]`);
      elements.forEach(el => {
        const value = el.getAttribute(attr);
        if (value) {
          // Special case for srcset which has multiple URLs
          if (attr === 'srcset') {
            const newSrcSet = value.split(',').map(src => {
              const [url, descriptor] = src.trim().split(/\s+/);
              return `${createProxyUrl(url, targetUrl)} ${descriptor || ''}`.trim();
            }).join(', ');
            el.setAttribute(attr, newSrcSet);
          } else {
            el.setAttribute(attr, createProxyUrl(value, targetUrl));
          }
        }
      });
    });
    
    // Process all CSS in style tags and inline styles
    document.querySelectorAll('style').forEach(styleEl => {
      const css = styleEl.textContent || '';
      const processedCss = css.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
        return `url("${createProxyUrl(url, targetUrl)}")`;
      });
      styleEl.textContent = processedCss;
    });
    
    // Process inline styles
    document.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style');
      if (style) {
        const processedStyle = style.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
          if (!url || url.startsWith('data:') || url.startsWith('blob:')) return match;
          return `url("${createProxyUrl(url, targetUrl)}")`;
        });
        el.setAttribute('style', processedStyle);
      }
    });
    
    // Inject code to bypass iframe protections
    const head = document.querySelector('head');
    if (head) {
      const script = document.createElement('script');
      script.textContent = `
        // Override frame detection
        (function() {
          try {
            // Save original properties
            const _self = window.self;
            const _parent = window.parent;
            const _top = window.top;
            
            // Override detection properties
            Object.defineProperty(window, 'self', { get: function() { return _self; } });
            Object.defineProperty(window, 'parent', { get: function() { return _self; } });
            Object.defineProperty(window, 'top', { get: function() { return _self; } });
            Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
            
            // Neutralize frame busting techniques
            const originalWindowOpen = window.open;
            window.open = function(url, target, features) {
              if (!url) return originalWindowOpen(url, target, features);
              if (url.startsWith('http')) {
                return window.location = '/api/proxy?url=' + encodeURIComponent(url);
              }
              return originalWindowOpen(url, target, features);
            };
            
            // Override document.domain to prevent cross-origin issues
            Object.defineProperty(document, 'domain', {
              get: function() { return '${parsedUrl.hostname}'; },
              set: function() { return '${parsedUrl.hostname}'; }
            });
            
            // Debug message to console
            console.log('Anti-frame protection engaged for:', '${targetUrl}');
          } catch(e) {
            console.warn('Frame protection override failed:', e);
          }
        })();
      `;
      head.appendChild(script);
    }
    
    // Remove X-Frame-Options and CSP meta tags
    document.querySelectorAll('meta').forEach(meta => {
      const httpEquiv = meta.getAttribute('http-equiv');
      if (httpEquiv && 
          ['x-frame-options', 'content-security-policy', 'frame-options'].includes(httpEquiv.toLowerCase())) {
        meta.remove();
      }
    });
    
    // Generate the processed HTML
    const processedHtml = dom.serialize();
    
    return new NextResponse(processedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Proxy-Status': 'processed',
        'Cache-Control': 'no-cache' // Don't cache HTML as it's dynamic
      }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    // Return a user-friendly error page
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
            <h1>Connection Error</h1>
            <p>We were unable to load the requested content.</p>
            <p>URL: ${targetUrl}</p>
            <button onclick="window.location.reload()">Try Again</button>
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