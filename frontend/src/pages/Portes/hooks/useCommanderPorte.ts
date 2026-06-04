import { useQueryClient, useMutation } from "@tanstack/react-query"
import { commanderPorte } from "../services/door.service"

export function useCommanderPorte() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      codePIN,
    }: {
      id: number
      action: "ouvrir" | "fermer"
      codePIN: string
    }) => commanderPorte(id, action, codePIN),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portes"] }),
  })
}
