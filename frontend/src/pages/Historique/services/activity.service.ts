import { apiClient } from "@/services/api.service"
import { type Activite } from "@/types/activity"

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ""

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

export async function exporterHistoriqueCSV(): Promise<void> {
  const token = (() => {
    try {
      const raw = localStorage.getItem("smart_bureau_auth")
      return raw ? (JSON.parse(raw) as { token?: string }).token : undefined
    } catch { return undefined }
  })()

  const res = await fetch(`${API_BASE}/historique-acces/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) throw new Error("Échec de l'export CSV.")

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `historique_acces_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
