import { useRole } from "@/hooks/useRole"
import { type Door } from "@/types/door"
import { useQuery } from "@tanstack/react-query"
import { recupererPortes } from "../services/door.service"

export function usePortes() {
  const { entrepriseId } = useRole()
  return useQuery<Door[], Error>({
    queryKey: ["portes", entrepriseId],
    queryFn: () => recupererPortes(),
    staleTime: 1000 * 60 * 3,
    enabled: entrepriseId !== null,
  })
}
