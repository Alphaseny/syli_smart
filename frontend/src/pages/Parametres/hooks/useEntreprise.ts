import { useRole } from "@/hooks/useRole"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { recupererEntreprise, modifierEntreprise, type ModifierEntreprisePayload } from "../services/parametres.service"

export function useEntreprise() {
  const { entrepriseId } = useRole()
  return useQuery({
    queryKey: ["entreprise", entrepriseId],
    queryFn: recupererEntreprise,
    enabled: entrepriseId !== null,
    staleTime: 1000 * 60 * 5,
  })
}

export function useModifierEntreprise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ModifierEntreprisePayload) => modifierEntreprise(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entreprise"] }),
  })
}
