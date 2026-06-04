import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type Alerte } from "@/types/alert"
import { Bell, CheckCircle, ShieldAlert, XCircle } from "lucide-react"
import { useIgnorerAlerte, useResoudreAlerte } from "../hooks/useResoudreAlerte"

const BADGE_NIVEAU: Record<string, "destructive" | "warning" | "info" | "default"> = {
  critique: "destructive",
  eleve: "warning",
  moyen: "info",
  faible: "default",
}

type Props = { alertes: Alerte[]; loading: boolean; error?: string }

export function AlertList({ alertes, loading, error }: Props) {
  const resoudre = useResoudreAlerte()
  const ignorer = useIgnorerAlerte()

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des alertes...</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!alertes.length) return <p className="text-sm text-muted-foreground">Aucune alerte détectée.</p>

  const actives = alertes.filter((a) => a.status === "non_traitee" || a.status === "en_cours")
  const traitees = alertes.filter((a) => a.status === "resolue" || a.status === "ignoree")

  return (
    <div className="space-y-6">
      {actives.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Actives ({actives.length})
          </h3>
          {actives.map((alerte) => (
            <div
              key={alerte.id}
              className="rounded-[3px] border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="capitalize">{alerte.type.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 font-medium">{alerte.description}</p>
                </div>
                <Badge variant={BADGE_NIVEAU[alerte.severity] ?? "default"}>
                  {alerte.severity}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Bell className="h-3.5 w-3.5" /> {alerte.date}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => ignorer.mutate(alerte.rawId)}
                    disabled={ignorer.isPending}
                  >
                    <XCircle className="h-4 w-4" /> Ignorer
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => resoudre.mutate(alerte.rawId)}
                    disabled={resoudre.isPending}
                  >
                    <CheckCircle className="h-4 w-4" /> Résoudre
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {traitees.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Traitées ({traitees.length})
          </h3>
          {traitees.map((alerte) => (
            <div
              key={alerte.id}
              className="rounded-[3px] border border-border bg-card p-5 opacity-60 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="capitalize">{alerte.type.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 font-medium">{alerte.description}</p>
                </div>
                <Badge variant="outline">{alerte.status === "resolue" ? "Résolue" : "Ignorée"}</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{alerte.date}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
