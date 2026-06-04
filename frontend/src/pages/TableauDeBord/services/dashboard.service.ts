import { apiClient } from "@/services/api.service"
import { type DashboardStats } from "@/types/dashboard"

type EquipementBackend = { etat: string; bureau_id: number }
type CameraBackend    = { id: number; equipement: EquipementBackend }
type PorteBackend     = { id: number; etat_verrou: string; equipement: EquipementBackend }
type LampeBackend     = { id: number; etat_lumiere: string; equipement: EquipementBackend }
type AlerteBackend    = { id: number; bureau_id: number; statut: string }
type UtilisateurBackend = { id: number; etat: boolean }
type HistoriqueBackend  = { id: number }

async function listerEnSecurite<T>(endpoint: string): Promise<T[]> {
  try { return await apiClient<T[]>(endpoint) } catch { return [] }
}

function filtrerBureau<T extends { equipement: EquipementBackend }>(
  items: T[],
  bureauId: number | null
): T[] {
  return bureauId != null ? items.filter((i) => i.equipement.bureau_id === bureauId) : items
}

export async function recupererStatsDashboard(
  bureauId?: number | null
): Promise<DashboardStats> {
  const [utilisateurs, alertes, cameras, portes, lampes, historiques] =
    await Promise.all([
      listerEnSecurite<UtilisateurBackend>("/utilisateurs"),
      listerEnSecurite<AlerteBackend>("/alertes"),
      listerEnSecurite<CameraBackend>("/cameras"),
      listerEnSecurite<PorteBackend>("/portes"),
      listerEnSecurite<LampeBackend>("/lampes"),
      listerEnSecurite<HistoriqueBackend>("/historique-acces"),
    ])

  const filtreId = bureauId ?? null
  const camerasFiltrees = filtrerBureau(cameras, filtreId)
  const portesFiltrees  = filtrerBureau(portes, filtreId)
  const lampesFiltrees  = filtrerBureau(lampes, filtreId)
  const alertesFiltrees = filtreId != null
    ? alertes.filter((a) => a.bureau_id === filtreId)
    : alertes

  return {
    users:         utilisateurs.length,
    alerts:        alertesFiltrees.length,
    cameras:       camerasFiltrees.length,
    events:        historiques.length,
    camerasOnline: camerasFiltrees.filter((c) => c.equipement.etat === "actif").length,
    doorsOpen:     portesFiltrees.filter((p) => p.etat_verrou === "ouvert").length,
    lightsOn:      lampesFiltrees.filter((l) => l.etat_lumiere === "allume").length,
    activeAlerts:  alertesFiltrees.filter(
      (a) => a.statut === "non_traitee" || a.statut === "en_cours"
    ).length,
  } satisfies DashboardStats
}
