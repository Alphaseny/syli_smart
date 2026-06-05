import { useQuery } from "@tanstack/react-query"
import { recupererStatsEnergie, type Periode } from "../services/energie.service"

export function useStatsEnergie(periode: Periode) {
  return useQuery({
    queryKey: ["energie", periode],
    queryFn: () => recupererStatsEnergie(periode),
    staleTime: 1000 * 60 * 2,
  })
}
