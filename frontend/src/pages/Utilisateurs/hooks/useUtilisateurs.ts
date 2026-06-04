import { useRole } from "@/hooks/useRole"
import { type Utilisateur } from "@/types/user"
import { useQuery } from "@tanstack/react-query"
import { recupererUtilisateurs } from "../services/utilisateur.service"

export function useUtilisateurs() {
  const { entrepriseId } = useRole()
  return useQuery<Utilisateur[], Error>({
    queryKey: ["utilisateurs", entrepriseId],
    queryFn: recupererUtilisateurs,
    staleTime: 1000 * 60 * 3,
    enabled: entrepriseId !== null,
  })
}
