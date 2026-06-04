import { apiClient } from "@/services/api.service"
import { type Alerte } from "@/types/alert"

type AlerteBackend = {
  id: number
  entreprise_id: number
  bureau_id: number
  equipement_id: number | null
  type_alerte: string
  niveau_urgence: string
  statut: string
  description: string
  traite_par: number | null
  date_alerte: string
  date_traitement: string | null
}

function transformerAlerte(alerte: AlerteBackend): Alerte {
  return {
    id: String(alerte.id),
    rawId: alerte.id,
    type: alerte.type_alerte,
    description: alerte.description,
    severity: alerte.niveau_urgence,
    status: alerte.statut,
    date: new Date(alerte.date_alerte).toLocaleString("fr-FR"),
  }
}

export async function recupererAlertes(): Promise<Alerte[]> {
  const reponse = await apiClient<AlerteBackend[]>("/alertes")
  return reponse.map(transformerAlerte)
}

export async function resoudreAlerte(id: number): Promise<void> {
  await apiClient(`/alertes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ statut: "resolue" }),
  })
}

export async function ignorerAlerte(id: number): Promise<void> {
  await apiClient(`/alertes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ statut: "ignoree" }),
  })
}
