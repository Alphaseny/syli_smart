import { apiClient } from "@/services/api.service"
import { type Lamp } from "@/types/lamp"

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

type LampeBackend = {
  id: number
  equipement_id: number
  etat_lumiere: string
  intensite_pct: number
  mode_auto: boolean
  equipement: EquipementBackend
}

function transformerLampe(lampe: LampeBackend): Lamp {
  return {
    id: String(lampe.id),
    rawId: lampe.id,
    bureauId: lampe.equipement.bureau_id,
    name: lampe.equipement.identifiant_mqtt,
    location: `Bureau ${lampe.equipement.bureau_id}`,
    state: lampe.etat_lumiere === "allume" ? "allumee" : "eteinte",
    intensite: lampe.intensite_pct,
  }
}

export async function recupererLampes(): Promise<Lamp[]> {
  const reponse = await apiClient<LampeBackend[]>("/lampes")
  return reponse.map(transformerLampe)
}

export type NouvelleLampe = {
  bureauId: number
  identifiantMqtt: string
  intensitePct: number
  modeAuto: boolean
  adresseIp?: string
}

export async function creerLampe(payload: NouvelleLampe): Promise<Lamp> {
  const lampe = await apiClient<LampeBackend>("/lampes", {
    method: "POST",
    body: JSON.stringify({
      bureau_id: payload.bureauId,
      identifiant_mqtt: payload.identifiantMqtt,
      adresse_ip: payload.adresseIp ?? null,
      etat: "actif",
      etat_lumiere: "eteint",
      intensite_pct: payload.intensitePct,
      mode_auto: payload.modeAuto,
    }),
  })
  return transformerLampe(lampe)
}

export async function supprimerLampe(id: number): Promise<void> {
  return apiClient<void>(`/lampes/${id}`, { method: "DELETE" })
}

export async function commanderLampe(
  id: number,
  action: "allumer" | "eteindre",
  intensitePct?: number
): Promise<{ message: string; etat_lumiere: string }> {
  return apiClient(`/iot/lampes/${id}/commande`, {
    method: "POST",
    body: JSON.stringify({ action, intensite_pct: intensitePct }),
  })
}
