import { type Utilisateur } from "@/types/user"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ajouterUtilisateur,
  type ValeursFormulaireUtilisateur,
} from "../services/utilisateur.service"

export function useAjouterUtilisateur() {
  const clientRequetes = useQueryClient()

  return useMutation<Utilisateur, Error, ValeursFormulaireUtilisateur>({
    mutationFn: ajouterUtilisateur,
    onSuccess: () =>
      clientRequetes.invalidateQueries({ queryKey: ["utilisateurs"] }),
  })
}
