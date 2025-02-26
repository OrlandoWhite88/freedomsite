"use client"

import { useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { WidgetGrid } from "@/components/widget-grid"
import { IframeView } from "@/components/iframe-view"

export default function Home() {
  const [currentService, setCurrentService] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader currentService={currentService} setCurrentService={setCurrentService} />
      {currentService ? (
        <IframeView service={currentService} />
      ) : (
        <main className="container mx-auto px-4 md:px-8 pt-16">
          <h1 className="text-4xl font-bold mb-8 text-center text-blue-500">Freedom Dashboard88</h1>
          <WidgetGrid setCurrentService={setCurrentService} />
        </main>
      )}
    </div>
  )
}

