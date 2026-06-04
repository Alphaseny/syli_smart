import { useQueryClient, useMutation } from "@tanstack/react-query"
import { creerPorte, type NouvellePorte } from "../services/door.service"

export function useCreerPorte() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NouvellePorte) => creerPorte(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portes"] }),
  })
}
