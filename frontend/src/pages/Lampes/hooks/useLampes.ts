import { useRole } from "@/hooks/useRole"
import { type Lamp } from "@/types/lamp"
import { useQuery } from "@tanstack/react-query"
import { recupererLampes } from "../services/lamp.service"

export function useLampes() {
  const { entrepriseId } = useRole()
  return useQuery<Lamp[], Error>({
    queryKey: ["lampes", entrepriseId],
    queryFn: () => recupererLampes(),
    staleTime: 1000 * 60 * 3,
    enabled: entrepriseId !== null,
  })
}
