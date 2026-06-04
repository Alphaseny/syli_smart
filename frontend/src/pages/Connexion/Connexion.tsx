import { useState } from "react"
import { Link } from "react-router-dom"
import { LoginForm } from "./components/LoginForm"
import { useConnexion } from "./hooks/useConnexion"

export function ConnexionPage() {
  const [error, setError] = useState<string | null>(null)
  const { login, isLoading } = useConnexion()

  return (
    <div className="w-96 space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-primary">Bienvenue</p>
        <h2 className="text-xl font-semibold">Connexion</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Accédez à votre tableau de bord Smart Bureau en toute sécurité.
        </p>
      </div>
      <LoginForm
        onSubmit={async (values) => {
          try {
            setError(null)
            await login(values.email, values.password)
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Impossible de se connecter"
            )
          }
        }}
        loading={isLoading}
      />
      {error ? (
        <div className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Pas de compte ?</p>
        <Link
          className="inline-flex items-center justify-center rounded-[3px] border border-border px-4 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
          to="/signup"
        >
          Créer un compte
        </Link>
      </div>
    </div>
  )
}
