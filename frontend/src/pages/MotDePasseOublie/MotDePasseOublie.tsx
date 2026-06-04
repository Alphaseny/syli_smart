import { useState } from "react"
import { Link } from "react-router-dom"
import { ForgotPasswordForm } from "./components/ForgotPasswordForm"
import { usePasswordReset } from "./hooks/usePasswordReset"

export function MotDePasseOubliePage() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { resetPassword, isLoading } = usePasswordReset()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          Récupération
        </p>
        <h2 className="text-xl font-semibold">Mot de passe oublié</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.
        </p>
      </div>
      <ForgotPasswordForm
        onSubmit={async (values) => {
          try {
            setError(null)
            setMessage(null)
            await resetPassword(values.email)
            setMessage(
              "Un lien de réinitialisation a été envoyé à votre adresse e-mail."
            )
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Impossible d’envoyer le lien"
            )
          }
        }}
        loading={isLoading}
      />
      {message ? (
        <div className="rounded-[3px] border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Retour à la connexion ?</p>
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
