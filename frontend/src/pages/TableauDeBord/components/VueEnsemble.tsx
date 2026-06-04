import { Badge } from "@/components/ui/badge"
import { formatCount } from "@/lib/utils"
import { type DashboardStats } from "@/types/dashboard"
import { Bell, CalendarDays, Camera, Users } from "lucide-react"

type Props = {
  stats?: DashboardStats
  loading: boolean
  error?: string
}

export function VueEnsemble({ stats, loading, error }: Props) {
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Chargement des statistiques...
      </p>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {/* Utilisateurs */}
      <div className="group relative flex h-[110px] flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-blue-500/5 blur-xl" />

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Utilisateurs actifs
          </p>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <Users size={16} strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="primary" className="px-2 py-0.5 text-[10px]">
            Total
          </Badge>

          <h2 className="text-xl font-bold tracking-tight">
            {formatCount(stats?.users ?? 0)}
          </h2>
        </div>
      </div>

      {/* Alertes */}
      <div className="group relative flex h-[110px] flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-red-500/5 blur-xl" />

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Alertes récentes
          </p>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
            <Bell size={16} strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">
            Suivi
          </Badge>

          <h2 className="text-xl font-bold tracking-tight">
            {formatCount(stats?.alerts ?? 0)}
          </h2>
        </div>
      </div>

      {/* Caméras */}
      <div className="group relative flex h-[110px] flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-green-500/5 blur-xl" />

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Caméras surveillées
          </p>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
            <Camera size={16} strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="success" className="px-2 py-0.5 text-[10px]">
            Disponibilité
          </Badge>

          <h2 className="text-xl font-bold tracking-tight">
            {formatCount(stats?.cameras ?? 0)}
          </h2>
        </div>
      </div>

      {/* Évènements */}
      <div className="group relative flex h-[110px] flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-cyan-500/5 blur-xl" />

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Évènements aujourd'hui
          </p>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
            <CalendarDays size={16} strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="info" className="px-2 py-0.5 text-[10px]">
            Historique
          </Badge>

          <h2 className="text-xl font-bold tracking-tight">
            {formatCount(stats?.events ?? 0)}
          </h2>
        </div>
      </div>
    </div>
  )
}
