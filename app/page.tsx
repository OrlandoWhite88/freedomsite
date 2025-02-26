"use client"

import { useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { WidgetGrid } from "@/components/widget-grid"
import { useRouter } from "next/navigation"

export default function Home() {
  const [currentService, setCurrentService] = useState<string | null>(null)
  const router = useRouter()

  // Create a handler for when a service is selected
  const handleServiceSelection = (service: string) => {
    let targetUrl = ""
    
    // Map service names to their actual URLs
    switch (service.toLowerCase()) {
      case "netflix":
        targetUrl = "https://www.netflix.com"
        break
      case "youtube":
        targetUrl = "https://www.youtube.com"
        break
      case "poki":
        targetUrl = "https://poki.com"
        break
      case "roblox":
        targetUrl = "https://www.roblox.com"
        break
      case "coolmathgames":
        targetUrl = "https://www.coolmathgames.com"
        break
      // Add more services as needed
      default:
        if (service.startsWith('http')) {
          targetUrl = service // If service is already a URL
        } else {
          targetUrl = `https://${service.toLowerCase()}.com`
        }
    }
    
    // Redirect to our proxy route with the target URL
    router.push(`/api/proxy?url=${encodeURIComponent(targetUrl)}`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader currentService={currentService} setCurrentService={setCurrentService} />
      <main className="container mx-auto px-4 md:px-8 pt-16">
        <h1 className="text-4xl font-bold mb-8 text-center text-blue-500">Freedom Dashboard</h1>
        <WidgetGrid setCurrentService={handleServiceSelection} />
      </main>
    </div>
  )
}