import { useQueryClient, useMutation } from "@tanstack/react-query"
import { creerLampe, type NouvelleLampe } from "../services/lamp.service"

export function useCreerLampe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NouvelleLampe) => creerLampe(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lampes"] }),
  })
}
