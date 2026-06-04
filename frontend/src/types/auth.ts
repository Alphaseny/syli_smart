export type UserCredentials = {
  email: string
  password: string
}

export type RegisterPayload = {
  nom_entreprise: string
  nom: string
  prenom: string
  email: string
  mot_de_passe: string
}

export type UserProfile = {
  id: string
  entreprise_id: number | null
  email: string
  fullName: string
  role: string
  bureau_id: number | null
}

export type AuthToken = {
  token: string
  user: UserProfile
}

export type AuthContextValue = {
  token: string
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<AuthToken>
  signOut: () => void
  register: (payload: RegisterPayload) => Promise<AuthToken>
  resetPassword: () => Promise<void>
}
