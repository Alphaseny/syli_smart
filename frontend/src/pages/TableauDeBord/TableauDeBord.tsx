import { EtatDesRessources } from "./components/EtatDesRessources"
import { VueEnsemble } from "./components/VueEnsemble"
import { useDashboardStats } from "./hooks/useDashboardStats"

export function TableauDeBordPage() {
  const { data, isLoading, error } = useDashboardStats()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        {/* Vue d’ensemble */}
        <div className="rounded-[3px] border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Vue d’ensemble</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Les indicateurs clés de votre infrastructure connectée.
          </p>
          <div className="mt-5">
            <VueEnsemble
              stats={data}
              loading={isLoading}
              error={error?.message}
            />
          </div>
        </div>

        {/* État des ressources */}
        <div className="rounded-[3px] border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">État des ressources</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Surveillance en temps réel de l’état, de la disponibilité et de la
            charge des équipements.
          </p>
          <EtatDesRessources data={data} />
        </div>
      </div>
    </div>
  )
}
