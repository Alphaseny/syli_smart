import { useQueryClient, useMutation } from "@tanstack/react-query"
import { resoudreAlerte, ignorerAlerte } from "../services/alert.service"

export function useResoudreAlerte() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => resoudreAlerte(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alertes"] }),
  })
}

export function useIgnorerAlerte() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => ignorerAlerte(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alertes"] }),
  })
}
