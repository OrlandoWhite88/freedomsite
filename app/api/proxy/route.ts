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
    const proxyReq = await new Promise((resolve, reject) => {
      const req = http.request({
        host: proxy.host,
        port: proxy.port,
        method: 'GET',
        path: targetUrl,
        timeout: 10000, // 10 second timeout
        headers: {
          'Host': parsedUrl.host,
          'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
          'Accept': '*/*',
          'Connection': 'close'
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
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            data
          });
        });
      });
      
      req.end();
    });
    
    // Return content from proxy
    return new NextResponse(JSON.stringify({ 
      message: 'Proxy request successful',
      url: targetUrl
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Proxy error details:', error);
    
    // Return error response with more details
    return new NextResponse(JSON.stringify({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      url: targetUrl
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}