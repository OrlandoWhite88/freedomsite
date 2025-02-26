"use client"

import { useEffect, useState, useRef } from "react"

interface IframeViewProps {
  service: string
}

// Enhanced service URL mapping with subdomains and paths
const serviceUrls: Record<string, string> = {
  "Netflix": "netflix.com",
  "YouTube": "youtube.com",
  "Poki": "poki.com",
  // Add more services as needed
}

export function IframeView({ service }: IframeViewProps) {
  const [height, setHeight] = useState("100vh")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 5
  
  // Keep track of URL history for back/forward navigation
  const [urlHistory, setUrlHistory] = useState<string[]>([])
  const [currentUrlIndex, setCurrentUrlIndex] = useState(-1)
  
  // Store the current URL for display
  const [currentUrl, setCurrentUrl] = useState<string>("")

  useEffect(() => {
    const updateHeight = () => {
      setHeight(`${window.innerHeight - 48}px`)
    }

    updateHeight()
    window.addEventListener("resize", updateHeight)
    
    // Reset states when service changes
    setLoading(true)
    setError(null)
    setRetryCount(0)
    setUrlHistory([])
    setCurrentUrlIndex(-1)
    
    // Set initial URL
    const targetUrl = serviceUrls[service] || "google.com"
    setCurrentUrl(targetUrl)
    
    return () => window.removeEventListener("resize", updateHeight)
  }, [service])

  // Get the target URL for the selected service
  const targetUrl = serviceUrls[service] || "google.com"
  
  // Determine proxy mode and parameters
  const getProxyUrl = (url: string, options: {
    bypassRewrite?: boolean;
    retry?: number;
    debug?: boolean;
  } = {}) => {
    const params = new URLSearchParams()
    params.set('url', url)
    
    if (options.retry && options.retry > 0) {
      params.set('retry', options.retry.toString())
    }
    
    if (options.bypassRewrite) {
      params.set('bypass', 'true')
    }
    
    if (options.debug) {
      params.set('debug', 'true')
    }
    
    return `/api/proxy?${params.toString()}`
  }
  
  const proxyUrl = getProxyUrl(targetUrl)

  // Handle iframe load/error events
  const handleLoad = () => {
    setLoading(false)
    setError(null)
    
    // Listen for messages from the iframe
    try {
      if (iframeRef.current?.contentWindow) {
        // Try to access the current URL from the iframe
        const iframeSrc = iframeRef.current.src;
        const urlParams = new URLSearchParams(iframeSrc.split('?')[1]);
        const currentProxiedUrl = urlParams.get('url') || targetUrl;
        
        setCurrentUrl(currentProxiedUrl);
        
        // Add current URL to history if it's new
        if (urlHistory.length === 0 || 
           (currentUrlIndex >= 0 && 
            urlHistory[currentUrlIndex] !== currentProxiedUrl)) {
          
          // If we navigated from history, trim the history
          const newHistory = currentUrlIndex < urlHistory.length - 1 
            ? urlHistory.slice(0, currentUrlIndex + 1) 
            : urlHistory;
            
          setUrlHistory([...newHistory, currentProxiedUrl]);
          setCurrentUrlIndex(newHistory.length);
        }
      }
    } catch (e) {
      console.error("Failed to update URL information:", e);
    }
    
    // Set up a message listener for communication with the iframe
    const handleIframeMessage = (event: MessageEvent) => {
      // Verify message source for security
      if (iframeRef.current && event.source === iframeRef.current.contentWindow) {
        if (event.data.type === 'navigation' && event.data.url) {
          // Update current URL
          setCurrentUrl(event.data.url);
          
          // Add to history
          const newHistory = currentUrlIndex < urlHistory.length - 1 
            ? urlHistory.slice(0, currentUrlIndex + 1) 
            : urlHistory;
            
          setUrlHistory([...newHistory, event.data.url]);
          setCurrentUrlIndex(newHistory.length);
        }
      }
    };
    
    window.addEventListener('message', handleIframeMessage);
    
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }

  const handleError = () => {
    setLoading(false)
    
    // Try a different approach if we haven't exceeded max retries
    if (retryCount < maxRetries) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      setError(`Loading attempt ${newRetryCount}/${maxRetries}... Trying different approach...`);
      
      // Try with bypass mode for odd retry attempts
      const shouldBypass = newRetryCount % 2 === 1;
      
      if (iframeRef.current) {
        iframeRef.current.src = getProxyUrl(targetUrl, {
          bypassRewrite: shouldBypass, 
          retry: newRetryCount,
          debug: true
        });
      }
    } else {
      setError("Failed to load content after multiple attempts. The site may be actively blocking our proxy or requires advanced authentication.");
    }
  }

  // Handle retry button click
  const handleRetry = (bypassRewrite: boolean = false) => {
    setLoading(true)
    setError(null)
    const newRetryCount = retryCount + 1
    setRetryCount(newRetryCount)
    
    if (iframeRef.current) {
      iframeRef.current.src = getProxyUrl(targetUrl, {
        bypassRewrite,
        retry: newRetryCount,
        debug: true
      });
    }
  }
  
  // Navigation handlers
  const goBack = () => {
    if (currentUrlIndex > 0 && iframeRef.current) {
      const newIndex = currentUrlIndex - 1;
      setCurrentUrlIndex(newIndex);
      const previousUrl = urlHistory[newIndex];
      setCurrentUrl(previousUrl);
      iframeRef.current.src = getProxyUrl(previousUrl);
      setLoading(true);
    }
  }
  
  const goForward = () => {
    if (currentUrlIndex < urlHistory.length - 1 && iframeRef.current) {
      const newIndex = currentUrlIndex + 1;
      setCurrentUrlIndex(newIndex);
      const nextUrl = urlHistory[newIndex];
      setCurrentUrl(nextUrl);
      iframeRef.current.src = getProxyUrl(nextUrl);
      setLoading(true);
    }
  }
  
  const refreshPage = () => {
    if (iframeRef.current) {
      setLoading(true);
      // Force a true refresh by recreating the src with a timestamp
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = currentSrc.includes('?') 
        ? `${currentSrc}&_t=${Date.now()}` 
        : `${currentSrc}?_t=${Date.now()}`;
    }
  }
  
  // Format URL for display
  const getDisplayUrl = (url: string) => {
    try {
      // Extract just the hostname and first part of the path
      const parsedUrl = new URL(url);
      let displayPath = parsedUrl.pathname;
      if (displayPath.length > 20) {
        displayPath = displayPath.substring(0, 20) + '...';
      }
      return `${parsedUrl.hostname}${displayPath}`;
    } catch (e) {
      return url;
    }
  };

  return (
    <div className="fixed top-12 left-0 right-0 w-full flex flex-col" style={{ height }}>
      {/* Enhanced Navigation Bar */}
      <div className="h-8 bg-background border-b flex items-center px-2 gap-2 text-sm">
        <button 
          onClick={goBack}
          disabled={currentUrlIndex <= 0}
          className="px-2 rounded hover:bg-gray-200 disabled:opacity-50"
          title="Go back"
        >
          ←
        </button>
        <button 
          onClick={goForward}
          disabled={currentUrlIndex >= urlHistory.length - 1}
          className="px-2 rounded hover:bg-gray-200 disabled:opacity-50"
          title="Go forward"
        >
          →
        </button>
        <button 
          onClick={refreshPage}
          className="px-2 rounded hover:bg-gray-200"
          title="Refresh page"
        >
          ↻
        </button>
        
        {/* URL display */}
        <div className="flex-1 truncate bg-gray-100 rounded px-2 py-0.5 text-xs">
          {currentUrl ? getDisplayUrl(currentUrl) : `${service} - ${targetUrl}`}
        </div>
        
        {/* Mode toggles */}
        <div className="flex gap-1">
          <button 
            onClick={() => handleRetry(true)}
            className="text-xs px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200"
            title="Bypass HTML rewriting"
          >
            Bypass
          </button>
          <button 
            onClick={() => {
              if (iframeRef.current) {
                const urlParams = new URLSearchParams(iframeRef.current.src.split('?')[1]);
                const url = urlParams.get('url') || targetUrl;
                window.open(url, '_blank');
              }
            }}
            className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200"
            title="Open in new tab"
          >
            Open
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-lg">Loading {service}...</p>
              <p className="text-sm text-gray-500">This may take a few moments</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-20">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
              <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Content</h2>
              <p className="mb-4">{error}</p>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => handleRetry()}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Try Again
                </button>
                <button 
                  onClick={() => handleRetry(true)}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Try Bypass Mode
                </button>
                <button 
                  onClick={() => window.location.href = '/'}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          src={proxyUrl}
          title={`${service} viewer`}
          className="w-full h-full border-none"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  )
}