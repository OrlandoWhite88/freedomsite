import { Widget } from "@/components/widget"

interface WidgetGridProps {
  setCurrentService: (service: string) => void
}

// Define all available services with their properties
const SERVICES = [
  {
    title: "Netflix",
    description: "Stream movies and TV shows",
    logo: "/placeholder.svg?height=400&width=600&text=Netflix",
    color: "bg-gradient-to-br from-red-600 to-red-800",
  },
  {
    title: "YouTube",
    description: "Watch videos, music, and live streams",
    logo: "/placeholder.svg?height=400&width=600&text=YouTube",
    color: "bg-gradient-to-br from-red-500 to-red-700",
  },
  {
    title: "Poki",
    description: "Play free online games",
    logo: "/placeholder.svg?height=400&width=600&text=Poki",
    color: "bg-gradient-to-br from-yellow-400 to-yellow-600",
  },
  // You can easily add more services here
]

export function WidgetGrid({ setCurrentService }: WidgetGridProps) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Choose a service to browse</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Select from our collection of entertainment services. All content is displayed through our advanced proxy system.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {SERVICES.map((service) => (
          <Widget
            key={service.title}
            title={service.title}
            logo={service.logo}
            description={service.description}
            color={service.color}
            onClick={() => setCurrentService(service.title)}
          />
        ))}
      </div>
      
      <div className="mt-12 border-t pt-8 text-center text-sm text-gray-500">
        <p>
          This proxy service allows you to access entertainment websites directly from this dashboard.
          <br />
          Some services may have limitations due to their security measures.
        </p>
      </div>
    </div>
  )
}