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
    
    return () => window.removeEventListener("resize", updateHeight)
  }, [service])

  // Get the target URL for the selected service
  const targetUrl = serviceUrls[service] || "google.com"
  
  // Determine proxy mode
  const getProxyUrl = (url: string, bypassRewrite: boolean = false, retry: number = retryCount) => {
    const params = new URLSearchParams()
    params.set('url', url)
    
    if (retry > 0) {
      params.set('retry', retry.toString())
    }
    
    if (bypassRewrite) {
      params.set('bypass', 'true')
    }
    
    return `/api/proxy?${params.toString()}`
  }
  
  const proxyUrl = getProxyUrl(targetUrl)

  // Handle iframe load/error events
  const handleLoad = () => {
    setLoading(false)
    setError(null)
    
    // Add current URL to history if it's new
    if (iframeRef.current?.src && 
       (urlHistory.length === 0 || 
        urlHistory[currentUrlIndex] !== iframeRef.current.src)) {
      
      // If we navigated from history, trim the history
      const newHistory = currentUrlIndex < urlHistory.length - 1 
        ? urlHistory.slice(0, currentUrlIndex + 1) 
        : urlHistory;
        
      setUrlHistory([...newHistory, iframeRef.current.src]);
      setCurrentUrlIndex(newHistory.length);
    }
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
        iframeRef.current.src = getProxyUrl(targetUrl, shouldBypass, newRetryCount);
      }
    } else {
      setError("Failed to load content after multiple attempts. The site may be actively blocking our proxy.");
    }
  }

  // Handle retry button click
  const handleRetry = (bypassRewrite: boolean = false) => {
    setLoading(true)
    setError(null)
    const newRetryCount = retryCount + 1
    setRetryCount(newRetryCount)
    
    if (iframeRef.current) {
      iframeRef.current.src = getProxyUrl(targetUrl, bypassRewrite, newRetryCount);
    }
  }
  
  // Navigation handlers
  const goBack = () => {
    if (currentUrlIndex > 0 && iframeRef.current) {
      const newIndex = currentUrlIndex - 1;
      setCurrentUrlIndex(newIndex);
      iframeRef.current.src = urlHistory[newIndex];
    }
  }
  
  const goForward = () => {
    if (currentUrlIndex < urlHistory.length - 1 && iframeRef.current) {
      const newIndex = currentUrlIndex + 1;
      setCurrentUrlIndex(newIndex);
      iframeRef.current.src = urlHistory[newIndex];
    }
  }
  
  const refreshPage = () => {
    if (iframeRef.current) {
      setLoading(true);
      iframeRef.current.src = iframeRef.current.src;
    }
  }

  return (
    <div className="fixed top-12 left-0 right-0 w-full flex flex-col" style={{ height }}>
      {/* Custom Navigation Bar */}
      <div className="h-8 bg-background border-b flex items-center px-2 gap-2">
        <button 
          onClick={goBack}
          disabled={currentUrlIndex <= 0}
          className="text-sm px-2 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          ←
        </button>
        <button 
          onClick={goForward}
          disabled={currentUrlIndex >= urlHistory.length - 1}
          className="text-sm px-2 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          →
        </button>
        <button 
          onClick={refreshPage}
          className="text-sm px-2 rounded hover:bg-gray-200"
        >
          ↻
        </button>
        <span className="flex-1 text-xs truncate text-gray-600">
          {service} - {targetUrl}
        </span>
        <button 
          onClick={() => handleRetry(true)}
          className="text-xs px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200"
        >
          Bypass Mode
        </button>
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