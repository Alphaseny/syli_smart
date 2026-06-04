export type Utilisateur = {
  id: string
  fullName: string
  email: string
  role: string
  status: "actif" | "inactif"
  bureau_id: number | null
}
