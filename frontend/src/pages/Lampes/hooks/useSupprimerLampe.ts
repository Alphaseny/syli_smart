import { useQueryClient, useMutation } from "@tanstack/react-query"
import { supprimerLampe } from "../services/lamp.service"

export function useSupprimerLampe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => supprimerLampe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lampes"] }),
  })
}
