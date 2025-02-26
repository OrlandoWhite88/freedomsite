"use client"

import { useEffect, useState } from "react"

interface IframeViewProps {
  service: string
}

// Service URL mapping
const serviceUrls: Record<string, string> = {
  "Netflix": "netflix.com",
  "YouTube": "youtube.com",
  "Poki": "poki.com"
}

export function IframeView({ service }: IframeViewProps) {
  const [height, setHeight] = useState("100vh")
  const [proxyUrl, setProxyUrl] = useState("")

  useEffect(() => {
    const updateHeight = () => {
      setHeight(`${window.innerHeight - 48}px`)
    }

    updateHeight()
    window.addEventListener("resize", updateHeight)
    
    const targetUrl = serviceUrls[service] || "google.com"
    setProxyUrl(`/api/proxy?url=${encodeURIComponent(targetUrl)}`)
    
    return () => window.removeEventListener("resize", updateHeight)
  }, [service])

  return (
    <div className="fixed top-12 left-0 right-0 w-full" style={{ height }}>
      <iframe
        src={proxyUrl}
        title={`${service} viewer`}
        className="w-full h-full border-none"
        allowFullScreen
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    </div>
  )
}