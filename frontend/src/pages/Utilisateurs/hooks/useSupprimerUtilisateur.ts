import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supprimerUtilisateur } from "../services/utilisateur.service"

export function useSupprimerUtilisateur() {
  const clientRequetes = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: supprimerUtilisateur,
    onSuccess: () =>
      clientRequetes.invalidateQueries({ queryKey: ["utilisateurs"] }),
  })
}
