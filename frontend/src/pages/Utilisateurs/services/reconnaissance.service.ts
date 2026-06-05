import { apiClient } from "@/services/api.service"

export type UtilisateurEnrole = {
  utilisateur_id: number
  nom_label: string
  date_enregistrement: string
}

export async function enregistrerVisage(utilisateurId: string, image: File): Promise<{ message: string }> {
  const form = new FormData()
  form.append("image", image)
  return apiClient(`/reconnaissance/enregistrer/${utilisateurId}`, {
    method: "POST",
    body: form,
  })
}

export async function supprimerVisage(utilisateurId: string): Promise<void> {
  return apiClient(`/reconnaissance/supprimer/${utilisateurId}`, { method: "DELETE" })
}

export async function listerVisagesEnroles(): Promise<UtilisateurEnrole[]> {
  return apiClient<UtilisateurEnrole[]>("/reconnaissance/utilisateurs")
}

export async function statutReconnaissance(): Promise<{ face_recognition_disponible: boolean; message: string }> {
  return apiClient("/reconnaissance/statut")
}
