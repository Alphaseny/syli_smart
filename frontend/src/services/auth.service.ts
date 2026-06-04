import { API_BASE_URL } from "@/constants/api"
import { apiClient } from "@/services/api.service"
import {
  type AuthToken,
  type RegisterPayload,
  type UserCredentials,
} from "@/types/auth"
import { useMutation, type UseMutationOptions } from "@tanstack/react-query"

type BackendUtilisateur = {
  id: number
  entreprise_id: number
  nom: string
  prenom: string
  email: string
  role: string
  bureau_id: number | null
}

function mapBackendUtilisateurToUserProfile(user: BackendUtilisateur) {
  return {
    id: String(user.id),
    entreprise_id: user.entreprise_id,
    email: user.email,
    fullName: `${user.nom} ${user.prenom}`.trim(),
    role: user.role,
    bureau_id: user.bureau_id ?? null,
  }
}

// ─── Async functions ──────────────────────────────────────────────────────────

export async function loginAsync(
  credentials: UserCredentials
): Promise<AuthToken> {
  /**
   * On bypass apiClient pour ce seul endpoint car OAuth2PasswordRequestForm
   * exige application/x-www-form-urlencoded — on fait un fetch direct
   * pour garder le contrôle total sur le Content-Type et le body.
   */
  const params = new URLSearchParams()
  params.append("grant_type", "password")
  params.append("username", credentials.email)
  params.append("password", credentials.password)

  const tokenRes = await fetch(`${API_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params,
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}))
    throw new Error(
      typeof err.detail === "string"
        ? err.detail
        : "Email ou mot de passe invalide."
    )
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    token_type: string
  }

  const user = await apiClient<BackendUtilisateur>(
    "/auth/me",
    { method: "GET" },
    tokenData.access_token
  )

  return {
    token: tokenData.access_token,
    user: mapBackendUtilisateurToUserProfile(user),
  }
}

export async function registerAsync(
  payload: RegisterPayload
): Promise<AuthToken> {
  await apiClient<BackendUtilisateur>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return loginAsync({
    email: payload.email,
    password: payload.mot_de_passe,
  })
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export function useLoginMutation(
  options?: UseMutationOptions<AuthToken, Error, UserCredentials>
) {
  return useMutation<AuthToken, Error, UserCredentials>({
    mutationFn: loginAsync,
    ...options,
  })
}

export function useRegisterMutation(
  options?: UseMutationOptions<AuthToken, Error, RegisterPayload>
) {
  return useMutation<AuthToken, Error, RegisterPayload>({
    mutationFn: registerAsync,
    ...options,
  })
}
