import { ActivityTimeline } from "./components/ActivityTimeline"
import { useActivites } from "./hooks/useActivites"

export function HistoriquePage() {
  const { data, isLoading, error } = useActivites()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Historique</p>
        <h2 className="text-2xl font-semibold">Journal d’activité</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Suivez les connexions, les ouvertures et les actions clés de votre
          système.
        </p>
      </div>
      <ActivityTimeline
        activities={data ?? []}
        loading={isLoading}
        error={error?.message}
      />
    </div>
  )
}
