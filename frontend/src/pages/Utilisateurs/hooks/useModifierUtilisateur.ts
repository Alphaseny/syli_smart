import { type Utilisateur } from "@/types/user"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  modifierUtilisateur,
  type ValeursFormulaireUtilisateur,
} from "../services/utilisateur.service"

export function useModifierUtilisateur() {
  const clientRequetes = useQueryClient()

  return useMutation<
    Utilisateur,
    Error,
    { id: string; valeurs: ValeursFormulaireUtilisateur }
  >({
    mutationFn: modifierUtilisateur,
    onSuccess: () =>
      clientRequetes.invalidateQueries({ queryKey: ["utilisateurs"] }),
  })
}
