"use client"

import { useEffect, useState } from "react"

interface IframeViewProps {
  service: string
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
  }, [])

  return (
    <div className="fixed top-12 left-0 right-0 w-full" style={{ height }}>
      <iframe
        src="https://www.google.com"
        title={`${service} viewer`}
        className="w-full h-full border-none"
        allowFullScreen
      />
    </div>
  )
}

