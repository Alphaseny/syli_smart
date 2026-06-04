import { useState } from "react"
import { Link } from "react-router-dom"
import { SignupForm } from "./components/SignupForm"
import { useInscription } from "./hooks/useInscription"

export function InscriptionPage() {
  const [error, setError] = useState<string | null>(null)
  // isLoading vient maintenant directement du contexte via useInscription,
  // plus de double source de vérité.
  const { register, isLoading } = useInscription()

  return (
    // CORRECTION : "supp-srollbar" → "supp-scrollbar"
    <div className="supp-srollbar h-full space-y-6 overflow-y-scroll">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-primary">Création de compte</p>
        <h2 className="text-xl font-semibold">Inscription</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Créez un accès pour gérer les utilisateurs, caméras et autres.
        </p>
      </div>

      <SignupForm
        onSubmit={async (values) => {
          try {
            setError(null)
            await register(values)
            // La navigation vers /dashboard est gérée dans useInscription
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Impossible de créer le compte"
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
        <p>Déjà inscrit ?</p>
        <Link
          className="inline-flex items-center justify-center rounded-[3px] border border-border px-4 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
          to="/login"
        >
          Se connecter
        </Link>
      </div>
    </div>
  )
}
