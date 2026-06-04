import { useQueryClient, useMutation } from "@tanstack/react-query"
import { commanderLampe } from "../services/lamp.service"

export function useCommanderLampe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      intensitePct,
    }: {
      id: number
      action: "allumer" | "eteindre"
      intensitePct?: number
    }) => commanderLampe(id, action, intensitePct),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lampes"] }),
  })
}
