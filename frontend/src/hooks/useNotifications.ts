import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  marquerLue,
  marquerToutesLues,
  recupererNotifications,
} from "@/services/notifications.service"

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: recupererNotifications,
    refetchInterval: 30_000, // rafraichit toutes les 30 s
    staleTime: 15_000,
  })
}

export function useMarquerLue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: marquerLue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  })
}

export function useMarquerToutesLues() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: marquerToutesLues,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  })
}
