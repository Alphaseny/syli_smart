import { useQueryClient, useMutation } from "@tanstack/react-query"
import { commanderLampe } from "../services/lamp.service"

export function useCommanderLampe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number
      action: "allumer" | "eteindre"
    }) => commanderLampe(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lampes"] }),
  })
}
