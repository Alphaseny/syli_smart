import { useAuthContext } from "@/contexts/auth-context"
import { useNavigate } from "react-router-dom"

/**
 * CORRECTION : suppression du useState(isLoading) local.
 * On réutilise isLoading du contexte (basé sur mutation.isPending),
 * une seule source de vérité.
 */
export function useConnexion() {
  const { signIn, isLoading } = useAuthContext()
  const navigate = useNavigate()

  const login = async (email: string, password: string) => {
    // L'erreur remonte vers ConnexionPage qui se charge de l'afficher
    await signIn(email, password)
    navigate("/dashboard")
  }

  return { login, isLoading }
}