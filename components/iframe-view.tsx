"use client"

import { useEffect, useState, useRef } from "react"

interface IframeViewProps {
  service: string
}

// Service URL mapping
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const updateHeight = () => {
      // Subtract header height (48px) from viewport height
      setHeight(`${window.innerHeight - 48}px`)
    }

    // Set initial height
    updateHeight()

    // Update height on window resize
    window.addEventListener("resize", updateHeight)

    // Reset states when service changes
    setLoading(true)
    setError(null)
    
    // Set a timeout to detect long-loading pages
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        setLoading(false)
        setError("This site is taking longer than expected to load. It may be blocked or very slow.")
      }
    }, 20000) // 20 second timeout
    
    return () => {
      window.removeEventListener("resize", updateHeight)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [service, loading])

  // Get the target URL for the selected service
  const targetUrl = serviceUrls[service] || "google.com"
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`

  // Handle iframe load event
  const handleLoad = () => {
    setLoading(false)
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  // Handle iframe error
  const handleError = () => {
    setLoading(false)
    setError("Failed to load content. The site may be blocking our requests.")
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  // Handle retry
  const handleRetry = () => {
    setLoading(true)
    setError(null)
    
    if (iframeRef.current) {
      // Add a cache buster to force reload
      const cacheBuster = `&cb=${Date.now()}`
      iframeRef.current.src = proxyUrl + cacheBuster
    }
  }

  return (
    <div className="fixed top-12 left-0 right-0 w-full" style={{ height }}>
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
            <div className="flex justify-between">
              <button 
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Try Again
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
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}