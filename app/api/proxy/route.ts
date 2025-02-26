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
    const parsedUrl = new URL(targetUrl);
    
    const options = {
      host: proxy.host,
      port: proxy.port,
      method: 'GET',
      path: targetUrl,
      headers: {
        'Host': parsedUrl.host,
        'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
      }
    };
    
    const proxyResponse = await new Promise((resolve, reject) => {
      const req = parsedUrl.protocol === 'https:' ? https.request(options) : http.request(options);
      
      req.on('response', (response) => {
        resolve(response);
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.end();
    });
    
    return new NextResponse('Proxy request successful', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Proxy request failed', { status: 500 });
  }
}