import { apiClient } from "@/services/api.service"
import { type Door } from "@/types/door"

// ── Types backend ─────────────────────────────────────────────────────────────

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

type PorteBackend = {
  id: number
  equipement_id: number
  etat_verrou: string
  mode_ouverture: string
  duree_ouverture_sec: number
  derniere_ouverture: string | null
  equipement: EquipementBackend
}

export type CodeAccesBackend = {
  id: number
  porte_id: number
  utilisateur_id: number | null
  etat: boolean
  nombre_utilisations: number
  limite_utilisations: number | null
  expire_le: string | null
  date_creation: string
}

// ── Transformateurs ───────────────────────────────────────────────────────────

function transformerPorte(porte: PorteBackend): Door {
  return {
    id: String(porte.id),
    rawId: porte.id,
    bureauId: porte.equipement.bureau_id,
    name: porte.equipement.identifiant_mqtt,
    location: `Bureau ${porte.equipement.bureau_id}`,
    state: porte.etat_verrou === "ouvert" ? "ouverte" : "fermee",
    lastActivity: porte.derniere_ouverture
      ? new Date(porte.derniere_ouverture).toLocaleString("fr-FR")
      : "Aucune activité",
    dureeOuvertureSec: porte.duree_ouverture_sec,
  }
}

// ── Requêtes CRUD ─────────────────────────────────────────────────────────────

export async function recupererPortes(): Promise<Door[]> {
  const reponse = await apiClient<PorteBackend[]>("/portes")
  return reponse.map(transformerPorte)
}

export type NouvellePorte = {
  bureauId: number
  identifiantMqtt: string
  modeOuverture: string
  dureeOuvertureSec: number
  adresseIp?: string
  codePinInitial: string
}

export async function creerPorte(payload: NouvellePorte): Promise<Door> {
  const porte = await apiClient<PorteBackend>("/portes", {
    method: "POST",
    body: JSON.stringify({
      bureau_id: payload.bureauId,
      identifiant_mqtt: payload.identifiantMqtt,
      adresse_ip: payload.adresseIp ?? null,
      etat: "actif",
      etat_verrou: "verrouille",
      mode_ouverture: payload.modeOuverture,
      duree_ouverture_sec: payload.dureeOuvertureSec,
    }),
  })
  // Créer le code PIN initial
  await apiClient("/codes-acces", {
    method: "POST",
    body: JSON.stringify({
      porte_id: porte.id,
      code_pin: payload.codePinInitial,
      limite_utilisations: null,
      expire_le: null,
    }),
  })
  return transformerPorte(porte)
}

export async function supprimerPorte(id: number): Promise<void> {
  return apiClient<void>(`/portes/${id}`, { method: "DELETE" })
}

// ── Commande IoT ──────────────────────────────────────────────────────────────

export async function commanderPorte(
  id: number,
  action: "ouvrir" | "fermer",
  codePIN: string
): Promise<{ message: string; etat_verrou: string }> {
  return apiClient(`/iot/portes/${id}/commande`, {
    method: "POST",
    body: JSON.stringify({ action, code_pin: codePIN }),
  })
}

// ── Codes d'accès ─────────────────────────────────────────────────────────────

export async function recupererCodesPorte(porteId: number): Promise<CodeAccesBackend[]> {
  const tous = await apiClient<CodeAccesBackend[]>("/codes-acces")
  return tous.filter((c) => c.porte_id === porteId)
}

export async function creerCode(
  porteId: number,
  codePIN: string,
  limiteUtilisations?: number
): Promise<CodeAccesBackend> {
  return apiClient<CodeAccesBackend>("/codes-acces", {
    method: "POST",
    body: JSON.stringify({
      porte_id: porteId,
      code_pin: codePIN,
      limite_utilisations: limiteUtilisations ?? null,
      expire_le: null,
    }),
  })
}

export async function revoquerCode(codeId: number): Promise<void> {
  return apiClient<void>(`/codes-acces/${codeId}`, {
    method: "PUT",
    body: JSON.stringify({ etat: false }),
  })
}
