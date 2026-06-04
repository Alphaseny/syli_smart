import { useRole } from "@/hooks/useRole"
import { type Camera } from "@/types/camera"
import { useQuery } from "@tanstack/react-query"
import { recupererCameras } from "../services/camera.service"

export function useCameras() {
  const { entrepriseId } = useRole()
  return useQuery<Camera[], Error>({
    queryKey: ["cameras", entrepriseId],
    queryFn: () => recupererCameras(),
    staleTime: 1000 * 60 * 3,
    enabled: entrepriseId !== null,
  })
}
