import { useRole } from "@/hooks/useRole"
import { type Alerte } from "@/types/alert"
import { useQuery } from "@tanstack/react-query"
import { recupererAlertes } from "../services/alert.service"

export function useAlertes() {
  const { entrepriseId } = useRole()
  return useQuery<Alerte[], Error>({
    queryKey: ["alertes", entrepriseId],
    queryFn: () => recupererAlertes(),
    staleTime: 1000 * 60 * 2,
    enabled: entrepriseId !== null,
  })
}
