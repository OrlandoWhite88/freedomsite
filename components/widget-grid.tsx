import { Widget } from "@/components/widget"

interface WidgetGridProps {
  setCurrentService: (service: string) => void
}

export function WidgetGrid({ setCurrentService }: WidgetGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <Widget
        title="Netflix"
        logo="/placeholder.svg?height=400&width=600&text=Netflix"
        color="bg-gradient-to-br from-red-600 to-red-800"
        onClick={() => setCurrentService("Netflix")}
      />
      <Widget
        title="YouTube"
        logo="/placeholder.svg?height=400&width=600&text=YouTube"
        color="bg-gradient-to-br from-red-500 to-red-700"
        onClick={() => setCurrentService("YouTube")}
      />
      <Widget
        title="Poki"
        logo="/placeholder.svg?height=400&width=600&text=Poki"
        color="bg-gradient-to-br from-yellow-400 to-yellow-600"
        onClick={() => setCurrentService("Poki")}
      />
    </div>
  )
}

