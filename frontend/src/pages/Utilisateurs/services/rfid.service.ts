import { apiClient } from "@/services/api.service"

export type CarteRfid = {
  id: number
  entreprise_id: number
  utilisateur_id: number | null
  uid_carte: string
  etat: boolean
  date_creation: string
}

export async function recupererCartesRfid(): Promise<CarteRfid[]> {
  return apiClient<CarteRfid[]>("/cartes-rfid")
}

export async function creerCarteRfid(utilisateurId: number, uid: string): Promise<CarteRfid> {
  return apiClient<CarteRfid>("/cartes-rfid", {
    method: "POST",
    body: JSON.stringify({ utilisateur_id: utilisateurId, uid_carte: uid }),
  })
}

export async function supprimerCarteRfid(id: number): Promise<void> {
  return apiClient<void>(`/cartes-rfid/${id}`, { method: "DELETE" })
}

export async function basculerEtatCarte(id: number, etat: boolean): Promise<CarteRfid> {
  return apiClient<CarteRfid>(`/cartes-rfid/${id}`, {
    method: "PUT",
    body: JSON.stringify({ etat }),
  })
}
