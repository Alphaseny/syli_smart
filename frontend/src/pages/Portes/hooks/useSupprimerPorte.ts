import { useQueryClient, useMutation } from "@tanstack/react-query"
import { supprimerPorte } from "../services/door.service"

export function useSupprimerPorte() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => supprimerPorte(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portes"] }),
  })
}
