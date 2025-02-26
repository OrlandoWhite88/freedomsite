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
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

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
    
    return () => window.removeEventListener("resize", updateHeight)
  }, [service])

  // Get the target URL for the selected service
  const targetUrl = serviceUrls[service] || "google.com"
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&debug=true`

  // Handle iframe load/error events
  const handleLoad = () => {
    setLoading(false)
    setError(null)
    
    // Check if the iframe content loaded correctly
    try {
      if (iframeRef.current) {
        // This will throw an error if cross-origin issues exist
        const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
        
        // If we can access the document but it contains an error message
        if (iframeDoc && iframeDoc.title.includes("Error")) {
          setError("The content couldn't be displayed. It may be protected.")
          
          // Try a different approach if we haven't exceeded max retries
          if (retryCount < maxRetries) {
            setRetryCount(prevCount => prevCount + 1)
            // Use a different proxy approach on retry
            iframeRef.current.src = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=alternative&retry=${retryCount + 1}`
          }
        }
      }
    } catch (e) {
      // Cross-origin error expected - this is normal if iframe loaded successfully
      setLoading(false)
    }
  }

  const handleError = () => {
    setLoading(false)
    setError("Failed to load content. The site may be blocking our requests.")
    
    // Try a different approach if we haven't exceeded max retries
    if (retryCount < maxRetries) {
      setRetryCount(prevCount => prevCount + 1)
      if (iframeRef.current) {
        iframeRef.current.src = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=alternative&retry=${retryCount + 1}`
      }
    }
  }

  // Handle retry button click
  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setRetryCount(prevCount => prevCount + 1)
    
    if (iframeRef.current) {
      iframeRef.current.src = `/api/proxy?url=${encodeURIComponent(targetUrl)}&retry=${retryCount + 1}`
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
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}