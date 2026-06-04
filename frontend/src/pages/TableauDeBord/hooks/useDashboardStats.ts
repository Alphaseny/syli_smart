import { useRole } from "@/hooks/useRole"
import { type DashboardStats } from "@/types/dashboard"
import { useQuery } from "@tanstack/react-query"
import { recupererStatsDashboard } from "../services/dashboard.service"

export function useDashboardStats() {
  const { estEmploye, bureauId } = useRole()
  const filtrerParBureau = estEmploye ? bureauId : null

  return useQuery<DashboardStats, Error>({
    queryKey: ["tableau-de-bord", "statistiques", filtrerParBureau],
    queryFn: () => recupererStatsDashboard(filtrerParBureau),
    staleTime: 1000 * 60,
    retry: 1,
  })
}
