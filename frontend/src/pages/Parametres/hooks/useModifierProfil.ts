import { useAuthContext } from "@/contexts/auth-context"
import { useMutation } from "@tanstack/react-query"
import { modifierProfil, type ModifierProfilPayload } from "../services/parametres.service"

export function useModifierProfil() {
  const { user } = useAuthContext()
  return useMutation({
    mutationFn: (payload: ModifierProfilPayload) => modifierProfil(user!.id, payload),
  })
}
