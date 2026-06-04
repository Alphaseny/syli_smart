import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail } from "lucide-react"
import { type FormEvent } from "react"

type Props = {
  onSubmit: (values: { email: string }) => Promise<void>
  loading: boolean
}

export function ForgotPasswordForm({ onSubmit, loading }: Props) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    await onSubmit({ email: String(formData.get("email") ?? "").trim() })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
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
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Envoi..." : "Envoyer le lien"}
      </Button>
    </form>
  )
}
