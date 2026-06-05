import { apiClient } from "@/services/api.service"

export type Notification = {
  id: number
  utilisateur_id: number
  titre: string
  message: string
  lue: boolean
  type: "alerte" | "securite" | "rappel"
  date_creation: string
}

export async function recupererNotifications(): Promise<Notification[]> {
  return apiClient<Notification[]>("/notifications")
}

export async function marquerLue(id: number): Promise<void> {
  return apiClient<void>(`/notifications/${id}/read`, { method: "PUT" })
}

export async function marquerToutesLues(): Promise<void> {
  return apiClient<void>("/notifications/read-all", { method: "PUT" })
}
