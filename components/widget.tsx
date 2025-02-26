// In Widget.tsx, change the onClick handler to redirect
import { useRouter } from "next/navigation"

export function Widget({ title, logo, description, color, onClick }: WidgetProps) {
  const router = useRouter()
  
  const handleClick = () => {
    // Get the URL for this service
    const serviceUrls: Record<string, string> = {
      "Netflix": "https://netflix.com",
      "YouTube": "https://youtube.com",
      "Poki": "https://poki.com",
    }
    
    const url = serviceUrls[title] || `https://${title.toLowerCase()}.com`
    
    // Redirect to the proxy
    router.push(`/api/simple-proxy?url=${encodeURIComponent(url)}`)
  }
  
  // Then in the Card component replace onClick={onClick} with onClick={handleClick}
}