"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { WidgetGrid } from "@/components/widget-grid"

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader currentService={null} setCurrentService={() => {}} />
      <main className="container mx-auto px-4 md:px-8 pt-16">
        <h1 className="text-4xl font-bold mb-8 text-center text-blue-500">Freedom Dashboard</h1>
        <WidgetGrid setCurrentService={() => {}} />
      </main>
    </div>
  )
}