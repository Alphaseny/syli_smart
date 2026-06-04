import { apiClient } from "@/services/api.service"

export type Bureau = {
  id: string
  nomBureau: string
  etage: string | null
  etat: boolean
  dateCreation: string
}

type BureauBackend = {
  id: number
  entreprise_id: number
  nom_bureau: string
  etage: string | null
  etat: boolean
  date_creation: string
}

export type ValeursFormulaireBureau = {
  nomBureau: string
  etage?: string
  etat?: boolean
}

function transformerBureau(bureau: BureauBackend): Bureau {
  return {
    id: String(bureau.id),
    nomBureau: bureau.nom_bureau,
    etage: bureau.etage,
    etat: bureau.etat,
    dateCreation: new Date(bureau.date_creation).toLocaleDateString("fr-FR"),
  }
}

export async function recupererBureaux(): Promise<Bureau[]> {
  const reponse = await apiClient<BureauBackend[]>("/bureaux")
  return reponse.map(transformerBureau)
}

export async function ajouterBureau(
  valeurs: ValeursFormulaireBureau
): Promise<Bureau> {
  const reponse = await apiClient<BureauBackend>("/bureaux", {
    method: "POST",
    body: JSON.stringify({
      nom_bureau: valeurs.nomBureau,
      etage: valeurs.etage ?? null,
      etat: valeurs.etat ?? true,
    }),
  })
  return transformerBureau(reponse)
}

export async function modifierBureau({
  id,
  valeurs,
}: {
  id: string
  valeurs: ValeursFormulaireBureau
}): Promise<Bureau> {
  const reponse = await apiClient<BureauBackend>(`/bureaux/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      nom_bureau: valeurs.nomBureau,
      etage: valeurs.etage ?? null,
      etat: valeurs.etat,
    }),
  })
  return transformerBureau(reponse)
}

export async function supprimerBureau(id: string): Promise<void> {
  return apiClient<void>(`/bureaux/${id}`, { method: "DELETE" })
}
