import { apiClient } from "@/services/api.service"

export type StatBureau = {
  bureau_id: number
  nom_bureau: string
  total_kwh: number
  cout_estime: number
}

export type StatEquipement = {
  equipement_id: number
  identifiant_mqtt: string
  bureau_id: number
  total_kwh: number
}

export type Recommandation = {
  type: string
  message: string
  economie_estimee_pct?: number
}

export type StatsEnergie = {
  periode: string
  consommation: {
    total_kwh: number
    cout_estime: number
    par_bureau: StatBureau[]
    par_equipement: StatEquipement[]
  }
  recommandations: Recommandation[]
}

export type Periode = "jour" | "semaine" | "mois"

export async function recupererStatsEnergie(periode: Periode = "semaine"): Promise<StatsEnergie> {
  return apiClient<StatsEnergie>(`/stats/energie?periode=${periode}`)
}
