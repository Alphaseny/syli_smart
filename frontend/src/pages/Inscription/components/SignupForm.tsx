import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Lock, Mail, User } from "lucide-react"
import { type FormEvent } from "react"

type ValeurFormulaire = {
  nom_entreprise: string
  nom: string
  prenom: string
  email: string
  mot_de_passe: string
}

type Props = {
  onSubmit: (valeurs: ValeurFormulaire) => Promise<void>
  loading: boolean
}

export function SignupForm({ onSubmit, loading }: Props) {
  const gererSoumission = async (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault()
    const donnees = new FormData(evenement.currentTarget)
    await onSubmit({
      nom_entreprise: String(donnees.get("nom_entreprise") ?? "").trim(),
      nom: String(donnees.get("nom") ?? "").trim(),
      prenom: String(donnees.get("prenom") ?? "").trim(),
      email: String(donnees.get("email") ?? "").trim(),
      mot_de_passe: String(donnees.get("mot_de_passe") ?? ""),
    })
  }

  return (
    <form className="space-y-4" onSubmit={gererSoumission}>
      {/* Nom de l'entreprise */}
      <div>
        <Label htmlFor="nom_entreprise">Nom de l'entreprise</Label>
        <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <Building2 size={16} strokeWidth={2.5} color={"oklch(0.56 0.2 250)"} />
          <Input id="nom_entreprise" name="nom_entreprise" placeholder="Smart Bureau SARL" required />
        </div>
      </div>

      {/* Nom */}
      <div>
        <Label htmlFor="nom">Nom</Label>
        <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <User size={16} strokeWidth={2.5} color={"oklch(0.56 0.2 250)"} />
          <Input id="nom" name="nom" placeholder="Camara" required />
        </div>
      </div>

      {/* Prénom */}
      <div>
        <Label htmlFor="prenom">Prénom</Label>
        <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <User size={16} strokeWidth={2.5} color={"oklch(0.56 0.2 250)"} />
          <Input id="prenom" name="prenom" placeholder="Alpha Sény" required />
        </div>
      </div>

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
        <Label htmlFor="mot_de_passe">Mot de passe</Label>
        <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <Lock size={16} strokeWidth={2.5} color={"oklch(0.56 0.2 250)"} />
          <Input
            id="mot_de_passe"
            name="mot_de_passe"
            type="password"
            placeholder="●●●●●●●●"
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Création..." : "Créer un compte"}
      </Button>
    </form>
  )
}
