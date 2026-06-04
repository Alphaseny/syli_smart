import { AlertList } from "./components/AlertList"
import { useAlertes } from "./hooks/useAlertes"

export function AlertesPage() {
  const { data, isLoading, error } = useAlertes()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Alertes</p>
        <h2 className="text-2xl font-semibold">Suivi des incidents</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Filtrez les alertes et gérez les incidents critiques.
        </p>
      </div>
      <AlertList
        alertes={data ?? []}
        loading={isLoading}
        error={error?.message}
      />
    </div>
  )
}
