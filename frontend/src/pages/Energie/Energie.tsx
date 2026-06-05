import { useState } from "react"
import { Lightbulb, TrendingDown, Zap } from "lucide-react"
import { useStatsEnergie } from "./hooks/useStatsEnergie"
import type { Periode } from "./services/energie.service"

type OngletPeriode = { val: Periode; label: string }
const PERIODES: OngletPeriode[] = [
  { val: "jour", label: "Aujourd'hui" },
  { val: "semaine", label: "7 jours" },
  { val: "mois", label: "30 jours" },
]

function CarteKpi({
  label,
  valeur,
  unite,
  icone: Icone,
  couleur,
}: {
  label: string
  valeur: string
  unite: string
  icone: React.ElementType
  couleur: string
}) {
  return (
    <div className="rounded-[3px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${couleur}`}>
          <Icone className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold">
        {valeur} <span className="text-sm font-normal text-muted-foreground">{unite}</span>
      </p>
    </div>
  )
}

function BarreProgression({ valeur, max }: { valeur: number; max: number }) {
  const pct = max > 0 ? Math.round((valeur / max) * 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function EnergiePage() {
  const [periode, setPeriode] = useState<Periode>("semaine")
  const { data, isLoading, error } = useStatsEnergie(periode)

  const parBureau = data?.consommation.par_bureau ?? []
  const maxBureau = Math.max(...parBureau.map((b) => b.total_kwh), 0.01)
  const recommandations = data?.recommandations ?? []

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Supervision</p>
          <h2 className="text-2xl font-semibold">Énergie</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Consommation électrique simulée par bureau et par équipement.
          </p>
        </div>

        {/* Sélecteur de période */}
        <div className="flex gap-1 rounded-[3px] border border-border bg-muted p-1 w-fit">
          {PERIODES.map((p) => (
            <button
              key={p.val}
              type="button"
              onClick={() => setPeriode(p.val)}
              className={`rounded-[3px] px-4 py-1.5 text-sm font-medium transition ${
                periode === p.val
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Chargement des données énergétiques...</p>
      )}
      {error && (
        <p className="text-sm text-destructive">Erreur : {error.message}</p>
      )}

      {data && (
        <>
          {/* KPI */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CarteKpi
              label="Consommation totale"
              valeur={data.consommation.total_kwh.toFixed(2)}
              unite="kWh"
              icone={Zap}
              couleur="bg-amber-500/10 text-amber-500"
            />
            <CarteKpi
              label="Coût estimé"
              valeur={data.consommation.cout_estime.toFixed(2)}
              unite="GNF"
              icone={TrendingDown}
              couleur="bg-green-500/10 text-green-500"
            />
            <CarteKpi
              label="Équipements suivis"
              valeur={String(data.consommation.par_equipement.length)}
              unite="lumières"
              icone={Lightbulb}
              couleur="bg-blue-500/10 text-blue-500"
            />
          </div>

          {/* Consommation par bureau */}
          <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
            <h3 className="text-base font-semibold">Consommation par bureau</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Répartition de la consommation électrique par espace de travail.
            </p>

            {parBureau.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Aucune donnée de consommation disponible pour cette période.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {parBureau.map((bureau) => (
                  <div key={bureau.bureau_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{bureau.nom_bureau}</span>
                      <span className="text-muted-foreground">
                        {bureau.total_kwh.toFixed(3)} kWh
                        <span className="ml-2 text-xs">
                          ({bureau.cout_estime.toFixed(0)} GNF)
                        </span>
                      </span>
                    </div>
                    <BarreProgression valeur={bureau.total_kwh} max={maxBureau} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommandations */}
          {recommandations.length > 0 && (
            <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
              <h3 className="text-base font-semibold">Recommandations d'optimisation</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Suggestions basées sur l'analyse de votre consommation.
              </p>
              <div className="mt-5 space-y-3">
                {recommandations.map((r, i) => (
                  <div
                    key={i}
                    className="flex gap-3 rounded-[3px] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10"
                  >
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                        {r.message}
                      </p>
                      {r.economie_estimee_pct != null && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          Économie estimée : {r.economie_estimee_pct} %
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tableau détail par équipement */}
          {data.consommation.par_equipement.length > 0 && (
            <div className="rounded-[3px] border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-base font-semibold">Détail par équipement</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Équipement</th>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Bureau</th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground">kWh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.consommation.par_equipement.map((eq) => (
                      <tr key={eq.equipement_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs">{eq.identifiant_mqtt}</td>
                        <td className="px-6 py-3 text-muted-foreground">Bureau {eq.bureau_id}</td>
                        <td className="px-6 py-3 text-right">{eq.total_kwh.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
