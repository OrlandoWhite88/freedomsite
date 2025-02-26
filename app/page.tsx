"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { WidgetGrid } from "@/components/widget-grid"
import { useRouter, useSearchParams } from "next/navigation"

export default function Home() {
  const [currentService, setCurrentService] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Check if we're returning from a proxied service
  useEffect(() => {
    const returnedFrom = searchParams?.get('returnedFrom')
    if (returnedFrom) {
      setCurrentService(returnedFrom)
    }
  }, [searchParams])

  // Handle going back to dashboard when a service is active
  const handleBackToDashboard = () => {
    setCurrentService(null)
    // This isn't technically needed for the new approach, but we'll keep it for state tracking
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader 
        currentService={currentService} 
        setCurrentService={handleBackToDashboard} 
      />
      <main className="container mx-auto px-4 md:px-8 pt-16">
        <h1 className="text-4xl font-bold mb-8 text-center text-blue-500">Freedom Dashboard</h1>
        <WidgetGrid setCurrentService={setCurrentService} />
      </main>
    </div>
  )
}