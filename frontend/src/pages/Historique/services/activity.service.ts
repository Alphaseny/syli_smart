import { apiClient } from "@/services/api.service"
import { type Activite } from "@/types/activity"

type HistoriqueBackend = {
  id: number
  porte_id: number
  utilisateur_id: number | null
  methode_ouverture: string
  resultat: string
  date_acces: string
}

function transformerActivite(entree: HistoriqueBackend): Activite {
  return {
    id: String(entree.id),
    type: "ouverture",
    title: `Accès ${entree.resultat}`,
    description: `Porte ${entree.porte_id} • ${entree.methode_ouverture}`,
    date: new Date(entree.date_acces).toLocaleString("fr-FR"),
  }
}

export async function recupererActivites(): Promise<Activite[]> {
  const reponse = await apiClient<HistoriqueBackend[]>("/historique-acces")
  return reponse.map(transformerActivite)
}
