import type { DashboardStats } from "@/types/dashboard";

export function EtatDesRessources({data}:{data: NoInfer<DashboardStats> | undefined}) {
  return <div className="mt-5 flex gap-3">
            <div className="rounded-[10px] bg-secondary/70 p-4 flex-1">
              <p className="text-sm font-medium text-secondary-foreground">
                Caméras en ligne
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {data?.camerasOnline ?? "--"}
              </p>
            </div>

            <div className="rounded-[10px] bg-secondary/70 p-4 flex-1">
              <p className="text-sm font-medium text-secondary-foreground">
                Portes ouvertes
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {data?.doorsOpen ?? "--"}
              </p>
            </div>

            <div className="rounded-[10px] bg-secondary/70 p-4 flex-1">
              <p className="text-sm font-medium text-secondary-foreground">
                Lampes allumées
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {data?.lightsOn ?? "--"}
              </p>
            </div>

            <div className="rounded-[10px] bg-secondary/70 p-4 flex-1">
              <p className="text-sm font-medium text-secondary-foreground">
                Alertes actives
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {data?.activeAlerts ?? "--"}
              </p>
            </div>
          </div>
}
