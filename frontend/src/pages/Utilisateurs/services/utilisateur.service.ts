import { apiClient } from "@/services/api.service"
import { type Utilisateur } from "@/types/user"

type UtilisateurBackend = {
  id: number
  entreprise_id: number
  bureau_id: number | null
  nom: string
  prenom: string
  email: string
  role: string
  etat: boolean
  date_creation: string
}

export type ValeursFormulaireUtilisateur = {
  fullName: string
  email: string
  role: string
  status: "actif" | "inactif"
  bureau_id?: number | null
  password?: string
}

function diviserNomComplet(nomComplet: string) {
  const parties = nomComplet.trim().split(/\s+/)
  const nom = parties[0] ?? ""
  const prenom = parties.slice(1).join(" ") || nom
  return { nom, prenom }
}

function transformerUtilisateur(utilisateur: UtilisateurBackend): Utilisateur {
  return {
    id: String(utilisateur.id),
    fullName: `${utilisateur.nom} ${utilisateur.prenom}`.trim(),
    email: utilisateur.email,
    role: utilisateur.role,
    status: utilisateur.etat ? "actif" : "inactif",
    bureau_id: utilisateur.bureau_id ?? null,
  }
}

function construirePayloadModification(valeurs: ValeursFormulaireUtilisateur) {
  const { nom, prenom } = diviserNomComplet(valeurs.fullName)
  const payload: Record<string, unknown> = {
    nom,
    prenom,
    email: valeurs.email,
    etat: valeurs.status === "actif",
    bureau_id: valeurs.bureau_id ?? null,
  }
  if (valeurs.password) {
    payload.mot_de_passe = valeurs.password
  }
  return payload
}

export async function recupererUtilisateurs(): Promise<Utilisateur[]> {
  const reponse = await apiClient<UtilisateurBackend[]>("/utilisateurs")
  return reponse.map(transformerUtilisateur)
}

export async function ajouterUtilisateur(
  valeurs: ValeursFormulaireUtilisateur
): Promise<Utilisateur> {
  const { nom, prenom } = diviserNomComplet(valeurs.fullName)
  const reponse = await apiClient<UtilisateurBackend>("/utilisateurs", {
    method: "POST",
    body: JSON.stringify({
      nom,
      prenom,
      email: valeurs.email,
      mot_de_passe: valeurs.password ?? "ChangeMe123!",
      role: valeurs.role,
      bureau_id: valeurs.bureau_id ?? null,
    }),
  })
  return transformerUtilisateur(reponse)
}

export async function modifierUtilisateur({
  id,
  valeurs,
}: {
  id: string
  valeurs: ValeursFormulaireUtilisateur
}): Promise<Utilisateur> {
  const reponse = await apiClient<UtilisateurBackend>(`/utilisateurs/${id}`, {
    method: "PUT",
    body: JSON.stringify(construirePayloadModification(valeurs)),
  })
  return transformerUtilisateur(reponse)
}

export async function supprimerUtilisateur(id: string): Promise<void> {
  return apiClient<void>(`/utilisateurs/${id}`, { method: "DELETE" })
}
