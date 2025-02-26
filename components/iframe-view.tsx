"use client"

import { useEffect, useState } from "react"

interface IframeViewProps {
  service: string
}

// Direct service URL mapping
const serviceUrls: Record<string, string> = {
  "Netflix": "https://netflix.com",
  "YouTube": "https://youtube.com",
  "Poki": "https://poki.com",
  // Add more services as needed
}

export function IframeView({ service }: IframeViewProps) {
  const [height, setHeight] = useState("100vh")

  useEffect(() => {
    const updateHeight = () => {
      // Subtract header height (48px) from viewport height
      setHeight(`${window.innerHeight - 48}px`)
    }

    // Set initial height
    updateHeight()

    // Update height on window resize
    window.addEventListener("resize", updateHeight)
    
    return () => window.removeEventListener("resize", updateHeight)
  }, [service])

  // Get the direct URL for the selected service (default to google if not found)
  const serviceUrl = serviceUrls[service] || "https://google.com"

  return (
    <div className="fixed top-12 left-0 right-0 w-full" style={{ height }}>
      <iframe
        src={serviceUrl}
        title={`${service} viewer`}
        className="w-full h-full border-none"
        allowFullScreen
        // These attributes help maximize iframe compatibility
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="no-referrer"
        // Remove sandbox to give maximum permissions to the iframe
      />
    </div>
  )
}