"use client"

import { Moon, Sun, Home } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

interface DashboardHeaderProps {
  currentService: string | null
  setCurrentService: (service: string | null) => void
}

export function DashboardHeader({ currentService, setCurrentService }: DashboardHeaderProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="fixed top-0 left-0 right-0 h-12 border-b bg-background/80 backdrop-blur-sm z-50">
      <div className="h-full px-4 flex justify-between items-center max-w-[1400px] mx-auto">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-blue-500">Freedom</h2>
          {currentService && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentService(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {currentService && <span className="text-sm text-muted-foreground">Currently viewing: {currentService}</span>}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

