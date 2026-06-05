import { apiClient } from "@/services/api.service"

// ── Types ──────────────────────────────────────────────────────────────────────

export type EntrepriseInfo = {
  id: number
  nom_entreprise: string
  image_entreprise: string | null
  etat: boolean
}

export type ModifierProfilPayload = {
  nom: string
  prenom: string
  email: string
  mot_de_passe?: string
}

export type ModifierEntreprisePayload = {
  nom_entreprise?: string
  image_entreprise?: string | null
}

// ── Appels API ─────────────────────────────────────────────────────────────────

export async function recupererEntreprise(): Promise<EntrepriseInfo> {
  return apiClient<EntrepriseInfo>("/entreprises")
}

export async function modifierEntreprise(payload: ModifierEntreprisePayload): Promise<EntrepriseInfo> {
  return apiClient<EntrepriseInfo>("/entreprises", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function modifierProfil(
  userId: string,
  payload: ModifierProfilPayload
): Promise<void> {
  await apiClient(`/utilisateurs/${userId}`, {
    method: "PUT",
    body: JSON.stringify({
      nom: payload.nom,
      prenom: payload.prenom,
      email: payload.email,
      ...(payload.mot_de_passe ? { mot_de_passe: payload.mot_de_passe } : {}),
    }),
  })
}
