import { NavLink } from "react-router-dom"
import { ArrowRight, Zap } from "lucide-react"
import { EtatDesRessources } from "./components/EtatDesRessources"
import { VueEnsemble } from "./components/VueEnsemble"
import { useDashboardStats } from "./hooks/useDashboardStats"
import { useStatsEnergie } from "@/pages/Energie/hooks/useStatsEnergie"
import { useActivites } from "@/pages/Historique/hooks/useActivites"

export function TableauDeBordPage() {
  const { data, isLoading, error } = useDashboardStats()
  const { data: energie } = useStatsEnergie("jour")
  const { data: activites = [] } = useActivites()

  const derniersAcces = activites.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Vue d’ensemble */}
      <div className="rounded-[3px] border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Vue d’ensemble</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Les indicateurs clés de votre infrastructure connectée.
        </p>
        <div className="mt-5">
          <VueEnsemble stats={data} loading={isLoading} error={error?.message} />
        </div>
      </div>

      {/* État des ressources */}
      <div className="rounded-[3px] border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">État des ressources</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Surveillance en temps réel de l’état, de la disponibilité et de la charge des équipements.
        </p>
        <EtatDesRessources data={data} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Widget énergie du jour */}
        <div className="rounded-[3px] border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Énergie aujourd’hui</h2>
              <p className="text-sm text-muted-foreground">Consommation électrique du jour.</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
          </div>

          {energie ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">
                  {energie.consommation.total_kwh.toFixed(2)}
                </span>
                <span className="mb-1 text-sm text-muted-foreground">kWh</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Coût estimé :{" "}
                <span className="font-medium text-foreground">
                  {energie.consommation.cout_estime.toFixed(0)} GNF
                </span>
              </p>
              {energie.recommandations[0] && (
                <div className="rounded-[3px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
                  {energie.recommandations[0].message}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Chargement...</p>
          )}

          <NavLink
            to="/energy"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Voir le tableau énergie <ArrowRight className="h-3 w-3" />
          </NavLink>
        </div>

        {/* Derniers accès */}
        <div className="rounded-[3px] border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Derniers accès</h2>
              <p className="text-sm text-muted-foreground">5 événements les plus récents.</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {derniersAcces.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun accès enregistré.</p>
            ) : (
              derniersAcces.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-[3px] border border-border px-3 py-2.5"
                >
                  <div
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      a.title.includes("succes") || a.title.includes("succès")
                        ? "bg-green-500"
                        : "bg-destructive"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{a.date}</span>
                </div>
              ))
            )}
          </div>

          <NavLink
            to="/history"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Voir tout l’historique <ArrowRight className="h-3 w-3" />
          </NavLink>
        </div>
      </div>
    </div>
  )
}
