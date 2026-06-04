import { apiClient } from "@/services/api.service"
import { useLoginMutation, useRegisterMutation } from "@/services/auth.service"
import { type AuthContextValue, type AuthToken } from "@/types/auth"
import { useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const CLE_STOCKAGE = "smart_bureau_auth"

type UtilisateurBackend = {
  id: number
  entreprise_id: number
  nom: string
  prenom: string
  email: string
  role: string
  bureau_id: number | null
}

function chargerAuthStocke(): AuthToken | null {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE)
    if (!brut) return null
    return JSON.parse(brut) as AuthToken
  } catch {
    return null
  }
}

function sauvegarderAuth(valeur: AuthToken | null) {
  if (!valeur) {
    window.localStorage.removeItem(CLE_STOCKAGE)
    return
  }
  window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(valeur))
}

function construireUser(utilisateur: UtilisateurBackend, token: string): AuthToken {
  return {
    token,
    user: {
      id: String(utilisateur.id),
      entreprise_id: utilisateur.entreprise_id,
      email: utilisateur.email,
      fullName: `${utilisateur.nom} ${utilisateur.prenom}`.trim(),
      role: utilisateur.role,
      bureau_id: utilisateur.bureau_id ?? null,
    },
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [auth, setAuth] = useState<AuthToken | null>(null)
  const [estEnVerification, setEstEnVerification] = useState(true)

  // Au démarrage : valide le token stocké en appelant /auth/me
  useEffect(() => {
    const stocke = chargerAuthStocke()
    if (!stocke?.token) {
      setEstEnVerification(false)
      return
    }
    apiClient<UtilisateurBackend>("/auth/me", { method: "GET" }, stocke.token)
      .then((utilisateur) => setAuth(construireUser(utilisateur, stocke.token)))
      .catch(() => sauvegarderAuth(null))
      .finally(() => setEstEnVerification(false))
  }, [])

  // Persiste en localStorage à chaque changement
  useEffect(() => {
    if (!estEnVerification) {
      sauvegarderAuth(auth)
    }
  }, [auth, estEnVerification])

  const loginMutation = useLoginMutation({
    onSuccess: (donnees) => setAuth(donnees),
  })

  const registerMutation = useRegisterMutation({
    onSuccess: (donnees) => setAuth(donnees),
  })

  // Vide tout le cache React Query à la déconnexion pour éviter
  // qu'un second utilisateur voie les données du précédent.
  const seDeconnecter = useCallback(() => {
    setAuth(null)
    queryClient.clear()
  }, [queryClient])

  const valeur = useMemo<AuthContextValue>(
    () => ({
      token: auth?.token ?? "",
      user: auth?.user ?? null,
      isAuthenticated: Boolean(auth?.token),
      isLoading:
        estEnVerification ||
        loginMutation.isPending ||
        registerMutation.isPending,
      error:
        loginMutation.error?.message ||
        registerMutation.error?.message ||
        null,

      signIn: (email, motDePasse) =>
        new Promise<AuthToken>((resolve, reject) => {
          loginMutation.mutate(
            { email, password: motDePasse },
            { onSuccess: resolve, onError: reject }
          )
        }),

      signOut: seDeconnecter,

      register: (payload) =>
        new Promise<AuthToken>((resolve, reject) => {
          registerMutation.mutate(payload, {
            onSuccess: resolve,
            onError: reject,
          })
        }),

      resetPassword: async () => {
        throw new Error(
          "La réinitialisation du mot de passe n'est pas disponible sur ce backend."
        )
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      auth,
      estEnVerification,
      loginMutation.isPending,
      loginMutation.error,
      registerMutation.isPending,
      registerMutation.error,
      seDeconnecter,
    ]
  )

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const contexte = useContext(AuthContext)
  if (!contexte) {
    throw new Error("useAuthContext doit être utilisé dans AuthProvider")
  }
  return contexte
}
