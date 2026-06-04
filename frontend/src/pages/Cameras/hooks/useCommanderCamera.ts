import { useQueryClient, useMutation } from "@tanstack/react-query"
import { commanderCamera, supprimerCamera } from "../services/camera.service"

export function useCommanderCamera() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "snapshot" | "enregistrement_on" | "enregistrement_off" }) =>
      commanderCamera(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  })
}

export function useSupprimerCamera() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => supprimerCamera(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  })
}
