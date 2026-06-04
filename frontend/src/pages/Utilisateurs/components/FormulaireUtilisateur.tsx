import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type Utilisateur } from "@/types/user"
import { Lock, Mail, ShieldCheck, User } from "lucide-react"
import { useEffect, useRef } from "react"
import { type ValeursFormulaireUtilisateur } from "../services/utilisateur.service"

type BureauOption = { id: string; nomBureau: string }

type Props = {
  utilisateur: Utilisateur | null
  bureaux: BureauOption[]
  loading: boolean
  onSubmit: (valeurs: ValeursFormulaireUtilisateur) => Promise<void>
  onCancel: () => void
}

function diviserNom(nomComplet: string) {
  const parties = nomComplet.trim().split(/\s+/)
  return { nom: parties[0] ?? "", prenom: parties.slice(1).join(" ") }
}

export function FormulaireUtilisateur({
  utilisateur,
  bureaux,
  loading,
  onSubmit,
  onCancel,
}: Props) {
  const refNom = useRef<HTMLInputElement>(null)
  const modeEdition = Boolean(utilisateur)
  const nomInitial = diviserNom(utilisateur?.fullName ?? "")

  useEffect(() => {
    refNom.current?.focus()
  }, [utilisateur])

  const gererSoumission = async (e: { currentTarget: HTMLFormElement; preventDefault(): void }) => {
    e.preventDefault()
    const d = new FormData(e.currentTarget)
    const nom = String(d.get("nom") ?? "").trim()
    const prenom = String(d.get("prenom") ?? "").trim()
    const role = String(d.get("role") ?? "employe")
    const bureauIdBrut = d.get("bureau_id")

    await onSubmit({
      fullName: `${nom} ${prenom}`.trim(),
      email: String(d.get("email") ?? "").trim(),
      role,
      status: String(d.get("status") ?? "actif") as "actif" | "inactif",
      bureau_id: bureauIdBrut ? Number(bureauIdBrut) : null,
      password: String(d.get("password") ?? "").trim() || undefined,
    })
  }

  return (
    <form className="space-y-4" onSubmit={gererSoumission}>
      {/* Nom / Prénom */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="nom">Nom</Label>
          <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <User size={16} strokeWidth={2.5} color="oklch(0.56 0.2 250)" />
            <Input
              ref={refNom}
              id="nom"
              name="nom"
              placeholder="Camara"
              defaultValue={nomInitial.nom}
              required
            />
          </div>
        </div>
        <div className="flex-1">
          <Label htmlFor="prenom">Prénom</Label>
          <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <User size={16} strokeWidth={2.5} color="oklch(0.56 0.2 250)" />
            <Input
              id="prenom"
              name="prenom"
              placeholder="Alpha Sény"
              defaultValue={nomInitial.prenom}
              required
            />
          </div>
        </div>
      </div>

      {/* Email / Mot de passe */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="email">Adresse e-mail</Label>
          <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <Mail size={16} strokeWidth={2.5} color="oklch(0.56 0.2 250)" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="exemple@email.com"
              defaultValue={utilisateur?.email ?? ""}
              required
            />
          </div>
        </div>
        <div className="flex-1">
          <Label htmlFor="password">
            {modeEdition ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
          </Label>
          <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <Lock size={16} strokeWidth={2.5} color="oklch(0.56 0.2 250)" />
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="●●●●●●●●"
              required={!modeEdition}
            />
          </div>
        </div>
      </div>

      {/* Rôle / Bureau */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="role">Rôle</Label>
          <div className="flex items-center gap-2 rounded-[3px] border border-border pl-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <ShieldCheck size={16} strokeWidth={2.5} color="oklch(0.56 0.2 250)" />
            <select
              id="role"
              name="role"
              className="flex-1 bg-background py-1.5 pr-2 text-sm"
              defaultValue={utilisateur?.role ?? "employe"}
              required
            >
              <option value="administrateur">Administrateur</option>
              <option value="employe">Employé</option>
            </select>
          </div>
        </div>
        <div className="flex-1">
          <Label htmlFor="bureau_id">Bureau</Label>
          <div className="flex items-center gap-2 rounded-[3px] border border-border pl-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <select
              id="bureau_id"
              name="bureau_id"
              className="flex-1 bg-background py-1.5 pr-2 text-sm"
              defaultValue={utilisateur?.bureau_id ?? ""}
            >
              <option value="">— Aucun bureau —</option>
              {bureaux.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nomBureau}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statut */}
      <div className="flex-1">
        <Label htmlFor="status">Statut</Label>
        <div className="flex items-center gap-2 rounded-[3px] border border-border pl-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <select
            id="status"
            name="status"
            className="flex-1 bg-background py-1.5 pr-2 text-sm"
            defaultValue={utilisateur?.status ?? "actif"}
          >
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
        </div>
      </div>

      {/* Boutons */}
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={loading}>
          {loading
            ? modeEdition ? "Modification..." : "Ajout..."
            : modeEdition ? "Modifier" : "Ajouter"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
