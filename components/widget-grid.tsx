import { useRouter } from "next/navigation";
import { Widget } from "@/components/widget";

interface WidgetGridProps {
  setCurrentService: (service: string) => void;
}

// Define all available services with their properties and URLs
const SERVICES = [
  {
    title: "Netflix",
    description: "Stream movies and TV shows",
    logo: "/placeholder.svg?height=400&width=600&text=Netflix",
    color: "bg-gradient-to-br from-red-600 to-red-800",
    url: "https://www.netflix.com"
  },
  {
    title: "YouTube",
    description: "Watch videos, music, and live streams",
    logo: "/placeholder.svg?height=400&width=600&text=YouTube",
    color: "bg-gradient-to-br from-red-500 to-red-700",
    url: "https://www.youtube.com"
  },
  {
    title: "Poki",
    description: "Play free online games",
    logo: "/placeholder.svg?height=400&width=600&text=Poki",
    color: "bg-gradient-to-br from-yellow-400 to-yellow-600",
    url: "https://poki.com"
  },
  // You can easily add more services here
];

export function WidgetGrid({ setCurrentService }: WidgetGridProps) {
  const router = useRouter();

  const handleServiceClick = (service: {title: string, url: string}) => {
    // Set the current service for header display
    setCurrentService(service.title);
    
    // Redirect directly to the proxy URL
    router.push(`/api/simple-proxy?url=${encodeURIComponent(service.url)}`);
  };

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Choose a service to browse</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Select from our collection of entertainment services. All content is displayed through our direct proxy system.
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
            onClick={() => handleServiceClick(service)}
          />
        ))}
      </div>
      
      <div className="mt-12 border-t pt-8 text-center text-sm text-gray-500">
        <p>
          This direct proxy service allows you to access entertainment websites seamlessly from this dashboard.
          <br />
          The new approach should work with most services without iframe restrictions.
        </p>
      </div>
    </div>
  );
}