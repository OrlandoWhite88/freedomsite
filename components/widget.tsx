import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"

interface WidgetProps {
  title: string
  logo: string
  color: string
  onClick: () => void
}

export function Widget({ title, logo, color, onClick }: WidgetProps) {
  return (
    <Card
      className="h-64 overflow-hidden group transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer"
      onClick={onClick}
    >
      <CardContent className={`${color} h-full p-0 relative`}>
        <Image
          src={logo || "/placeholder.svg"}
          alt={`${title} logo`}
          layout="fill"
          objectFit="cover"
          className="transition-all duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
          <span className="text-white text-2xl font-bold opacity-0 group-hover:opacity-100 transition-all duration-300">
            Open {title}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

