import { NextRequest, NextResponse } from 'next/server';
import { URL } from 'url';
import https from 'https';
import http from 'http';

// List of proxy servers
const PROXY_SERVERS = [
  '38.170.116.64:8800',
  '196.51.117.147:8800',
  '196.51.117.70:8800',
  '38.170.116.118:8800',
  '196.51.114.200:8800',
  '212.115.62.108:8800',
  '196.51.114.234:8800',
  '38.170.116.229:8800',
  '212.115.62.193:8800',
  '38.170.116.225:8800'
];

function getRandomProxy() {
  const randomIndex = Math.floor(Math.random() * PROXY_SERVERS.length);
  const [host, port] = PROXY_SERVERS[randomIndex].split(':');
  return { host, port: parseInt(port) };
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
    const proxy = getRandomProxy();
    console.log(`Using proxy: ${proxy.host}:${proxy.port} for target: ${targetUrl}`);
    
    const parsedUrl = new URL(targetUrl);
    
    // Create a proper HTTP/HTTPS request through the proxy
    const proxyResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        host: proxy.host,
        port: proxy.port,
        method: 'GET',
        path: targetUrl,
        timeout: 30000, // 30 second timeout
        headers: {
          'Host': parsedUrl.host,
          'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive'
        }
      });
      
      req.on('error', (error) => {
        console.error(`Proxy error for ${proxy.host}:${proxy.port}:`, error.message);
        reject(error);
      });
      
      req.on('timeout', () => {
        console.error(`Proxy request timed out for ${proxy.host}:${proxy.port}`);
        req.destroy();
        reject(new Error('Proxy request timed out'));
      });
      
      // Get response and read data
      req.on('response', (response) => {
        let data = [];
        
        response.on('data', (chunk) => {
          data.push(chunk);
        });
        
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            data: Buffer.concat(data)
          });
        });
      });
      
      req.end();
    });
    
    // Type assertion to access the properties safely
    const typedResponse = proxyResponse as { 
      statusCode: number; 
      headers: http.IncomingHttpHeaders;
      data: Buffer;
    };
    
    // Get the content type from the response or default to HTML
    const contentType = typedResponse.headers['content-type'] || 'text/html';
    
    // Return the actual content from the proxied website
    return new NextResponse(typedResponse.data, {
      status: typedResponse.statusCode || 200,
      headers: { 
        'Content-Type': contentType
      }
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
            <p>Sorry, we couldn't connect to the requested website through our proxy.</p>
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