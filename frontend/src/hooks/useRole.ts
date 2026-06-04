import { useAuthContext } from "@/contexts/auth-context"

export function useRole() {
  const { user } = useAuthContext()
  return {
    estAdmin:    user?.role === "administrateur",
    estEmploye:  user?.role === "employe",
    bureauId:    user?.bureau_id    ?? null,
    entrepriseId: user?.entreprise_id ?? null,
  }
}
