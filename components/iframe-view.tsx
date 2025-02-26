"use client"

import { useEffect, useState } from "react"

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

  useEffect(() => {
    const updateHeight = () => {
      // Subtract header height (48px) from viewport height
      setHeight(`${window.innerHeight - 48}px`)
    }

    // Set initial height
    updateHeight()

    // Update height on window resize
    window.addEventListener("resize", updateHeight)

    // Set loading state
    setLoading(true)
    
    return () => window.removeEventListener("resize", updateHeight)
  }, [service])

  // Get the target URL for the selected service
  const targetUrl = serviceUrls[service] || "google.com"
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`

  return (
    <div className="fixed top-12 left-0 right-0 w-full" style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-lg">Loading {service}...</p>
          </div>
        </div>
      )}
      <iframe
        src={proxyUrl}
        title={`${service} viewer`}
        className="w-full h-full border-none"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        onLoad={() => setLoading(false)}
      />
    </div>
  )
}