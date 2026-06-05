import { apiClient } from "@/services/api.service"

export type Rappel = {
  id: number
  utilisateur_id: number
  bureau_id: number | null
  titre: string
  description: string | null
  date_rappel: string
  execute: boolean
}

export type NouveauRappel = {
  titre: string
  description?: string
  date_rappel: string
  bureau_id?: number
}

export type SuggestionHabitude = {
  bureau_id: number
  heure_habituelle: string
  action: string
  frequence_jours: number
  suggestion: string
}

export async function recupererRappels(): Promise<Rappel[]> {
  return apiClient<Rappel[]>("/rappels")
}

export async function creerRappel(payload: NouveauRappel): Promise<Rappel> {
  return apiClient<Rappel>("/rappels", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function modifierRappel(
  id: number,
  payload: Partial<NouveauRappel & { execute: boolean }>
): Promise<Rappel> {
  return apiClient<Rappel>(`/rappels/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function supprimerRappel(id: number): Promise<void> {
  return apiClient<void>(`/rappels/${id}`, { method: "DELETE" })
}

export async function recupererSuggestionsHabitudes(): Promise<SuggestionHabitude[]> {
  return apiClient<SuggestionHabitude[]>("/stats/habits")
}
