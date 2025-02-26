import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"

interface WidgetProps {
  title: string
  logo: string
  description: string
  color: string
  onClick: () => void
}

// Default descriptions for services
const DEFAULT_DESCRIPTIONS = {
  "Netflix": "Stream movies and TV shows",
  "YouTube": "Watch videos, music, and live streams",
  "Poki": "Play free online games",
}

export function Widget({ title, logo, description, color, onClick }: WidgetProps) {
  // Use default description if none provided
  const widgetDescription = description || DEFAULT_DESCRIPTIONS[title as keyof typeof DEFAULT_DESCRIPTIONS] || "";
  
  // Use appropriate logo paths
  const logoPath = logo || `/logos/${title.toLowerCase()}.svg`;
  
  return (
    <Card
      className="overflow-hidden group transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer"
      onClick={onClick}
    >
      <CardContent className={`${color} h-64 p-0 relative flex flex-col`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-50 group-hover:opacity-70 transition-all duration-300" />
        
        <div className="relative flex-1 p-6 flex items-center justify-center">
          <div className="w-3/4 h-3/4 relative">
            <Image
              src={logoPath}
              alt={`${title} logo`}
              layout="fill"
              objectFit="contain"
              className="transition-all duration-300 group-hover:scale-110"
              onError={(e) => {
                // Fallback to placeholder if logo fails to load
                const target = e.target as HTMLImageElement;
                target.src = `/placeholder.svg?text=${title}`;
              }}
            />
          </div>
        </div>
        
        <div className="relative p-4 text-white z-10 bg-gradient-to-t from-black/80 to-transparent">
          <h3 className="text-2xl font-bold mb-1">{title}</h3>
          <p className="text-sm opacity-80">{widgetDescription}</p>
          <p className="text-xs mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white/20 inline-block px-2 py-1 rounded">
            Click to open
          </p>
        </div>
      </CardContent>
    </Card>
  )
}