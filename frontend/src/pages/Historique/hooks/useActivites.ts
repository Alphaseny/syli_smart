import { useRole } from "@/hooks/useRole"
import { type Activite } from "@/types/activity"
import { useQuery } from "@tanstack/react-query"
import { recupererActivites } from "../services/activity.service"

export function useActivites() {
  const { entrepriseId } = useRole()
  return useQuery<Activite[], Error>({
    queryKey: ["historique", entrepriseId],
    queryFn: recupererActivites,
    staleTime: 1000 * 60 * 3,
    enabled: entrepriseId !== null,
  })
}
