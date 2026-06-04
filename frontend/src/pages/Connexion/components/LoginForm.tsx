import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Mail } from "lucide-react"
import { type FormEvent } from "react"
import { Link } from "react-router-dom"

type FormValues = {
  email: string
  password: string
}

type Props = {
  onSubmit: (values: FormValues) => Promise<void>
  loading: boolean
}

export function LoginForm({ onSubmit, loading }: Props) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values: FormValues = {
      email: String(new FormData(form).get("email") ?? "").trim(),
      // CORRECTION : name="password" pour correspondre à formData.get("password")
      password: String(new FormData(form).get("password") ?? ""),
    }
    await onSubmit(values)
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Adresse e-mail */}
      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <Mail size={16} strokeWidth={2.5} color={"oklch(0.56 0.2 250)"} />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="alphaseny.camara.224@gmail.com"
            required
          />
        </div>
      </div>

      {/* Mot de passe */}
      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <Lock size={16} strokeWidth={2.5} color={"oklch(0.56 0.2 250)"} />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="●●●●●●●●"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Link
          className="font-medium text-primary hover:underline"
          to="/forgot-password"
        >
          Mot de passe oublié ?
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Chargement..." : "Se connecter"}
      </Button>
    </form>
  )
}
