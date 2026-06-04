import { useQueryClient, useMutation } from "@tanstack/react-query"
import { creerCamera, type NouvelleCamera } from "../services/camera.service"

export function useCreerCamera() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NouvelleCamera) => creerCamera(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  })
}
