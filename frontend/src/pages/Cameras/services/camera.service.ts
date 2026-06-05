import { apiClient } from "@/services/api.service"
import { type Camera } from "@/types/camera"

type EquipementBackend = {
  id: number
  entreprise_id: number
  bureau_id: number
  type_equipement: string
  identifiant_mqtt: string
  etat: string
  adresse_ip: string | null
  date_creation: string
}

type CameraBackend = {
  id: number
  equipement_id: number
  resolution: string
  lien_flux_video: string | null
  lien_snapshot: string | null
  enregistrement_actif: boolean
  equipement: EquipementBackend
}

function transformerCamera(c: CameraBackend): Camera {
  return {
    id: String(c.id),
    rawId: c.id,
    bureauId: c.equipement.bureau_id,
    name: c.equipement.identifiant_mqtt,
    location: `Bureau ${c.equipement.bureau_id}`,
    isOnline: c.equipement.etat === "actif",
    streamUrl: c.lien_flux_video ?? undefined,
    snapshotUrl: c.lien_snapshot ?? undefined,
    enregistrementActif: c.enregistrement_actif,
  }
}

export async function recupererCameras(): Promise<Camera[]> {
  const reponse = await apiClient<CameraBackend[]>("/cameras")
  return reponse.map(transformerCamera)
}

export type NouvelleCamera = {
  bureauId: number
  identifiantMqtt: string
  adresseIp?: string
  resolution?: string
  lienFluxVideo?: string
  lienSnapshot?: string
}

export async function creerCamera(payload: NouvelleCamera): Promise<Camera> {
  const c = await apiClient<CameraBackend>("/cameras", {
    method: "POST",
    body: JSON.stringify({
      bureau_id: payload.bureauId,
      identifiant_mqtt: payload.identifiantMqtt,
      adresse_ip: payload.adresseIp ?? null,
      etat: "actif",
      resolution: payload.resolution ?? "640x480",
      lien_flux_video: payload.lienFluxVideo || (payload.adresseIp ? `http://${payload.adresseIp}/stream` : null),
      lien_snapshot: payload.lienSnapshot || (payload.adresseIp ? `http://${payload.adresseIp}/capture` : null),
      enregistrement_actif: false,
    }),
  })
  return transformerCamera(c)
}

export async function pingCamera(
  id: number,
): Promise<{ camera_id: number; en_ligne: boolean; raison: string }> {
  return apiClient(`/cameras/${id}/ping`, { method: "POST" })
}

export async function supprimerCamera(id: number): Promise<void> {
  return apiClient<void>(`/cameras/${id}`, { method: "DELETE" })
}

export async function commanderCamera(
  id: number,
  action: "snapshot" | "enregistrement_on" | "enregistrement_off"
): Promise<{ message: string }> {
  return apiClient(`/iot/cameras/${id}/commande`, {
    method: "POST",
    body: JSON.stringify({ action }),
  })
}
