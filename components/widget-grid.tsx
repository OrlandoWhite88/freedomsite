// In widget-grid.tsx
import { useRouter } from "next/navigation"
import { Widget } from "@/components/widget"

interface WidgetGridProps {
  setCurrentService: (service: string) => void  // Keep the interface the same
}

export function WidgetGrid({ setCurrentService }: WidgetGridProps) {
  const router = useRouter()
  
  const handleServiceClick = (title: string) => {
    // Map service title to URL
    const serviceUrls: Record<string, string> = {
      "Netflix": "https://netflix.com",
      "YouTube": "https://youtube.com",
      "Poki": "https://poki.com",
    }
    
    const url = serviceUrls[title] || `https://${title.toLowerCase()}.com`
    
    // Redirect to proxy
    router.push(`/api/simple-proxy?url=${encodeURIComponent(url)}`)
  }
  
  // Then when rendering each Widget, use:
  // onClick={() => handleServiceClick(service.title)}
}