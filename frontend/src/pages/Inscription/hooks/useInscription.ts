import { useAuthContext } from "@/contexts/auth-context"
import { type RegisterPayload } from "@/types/auth"
import { useNavigate } from "react-router-dom"

/**
 * CORRECTION : suppression du useState(isLoading) local.
 *
 * Avant, on avait deux sources de vérité pour isLoading :
 *   - un useState local dans ce hook
 *   - le isLoading exposé par useAuthContext (basé sur mutation.isPending)
 *
 * Maintenant on réutilise directement isLoading du contexte,
 * qui est déjà synchronisé avec TanStack Query.
 */
export function useInscription() {
  const { register, isLoading } = useAuthContext()
  const navigate = useNavigate()

  const signUp = async (payload: RegisterPayload) => {
    // L'erreur remonte naturellement vers l'appelant (InscriptionPage)
    // qui se charge de l'afficher.
    await register(payload)
    navigate("/dashboard")
  }

  return { register: signUp, isLoading }
}
