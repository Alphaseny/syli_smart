import { API_BASE_URL } from "@/constants/api"

function getStoredAuthToken(): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const raw = window.localStorage.getItem("smart_bureau_auth")
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { token?: string }
    return parsed?.token
  } catch {
    return undefined
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`

  const headers = new Headers(options.headers)

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  const authToken = token ?? getStoredAuthToken()
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`)
  }

  // CORRECTION : on ne set Content-Type que si l'appelant n'en a pas déjà
  // défini un. Ainsi, "application/x-www-form-urlencoded" passé par
  // auth.service n'est pas écrasé par "application/json".
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorMessage = response.statusText
    try {
      const errorBody = await response.json()
      if (typeof errorBody?.detail === "string") {
        errorMessage = errorBody.detail
      } else if (Array.isArray(errorBody?.detail)) {
        errorMessage = errorBody.detail
          .map((e: { msg: string }) => e.msg)
          .join(", ")
      }
    } catch {
      // garde statusText
    }
    throw new Error(errorMessage)
  }

  // 204 No Content — pas de body à parser (DELETE, etc.)
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T
  }

  return (await response.json()) as T
}
