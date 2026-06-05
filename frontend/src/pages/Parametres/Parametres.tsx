import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthContext } from "@/contexts/auth-context"
import { useRole } from "@/hooks/useRole"
import { Building2, CheckCircle, User } from "lucide-react"
import { useState } from "react"
import { useEntreprise, useModifierEntreprise } from "./hooks/useEntreprise"
import { useModifierProfil } from "./hooks/useModifierProfil"

type Onglet = "profil" | "entreprise"

function MessageSucces({ texte }: { texte: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[3px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
      <CheckCircle className="h-4 w-4 shrink-0" />
      {texte}
    </div>
  )
}

function MessageErreur({ texte }: { texte: string }) {
  return (
    <div className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {texte}
    </div>
  )
}

// ── Onglet Profil ─────────────────────────────────────────────────────────────

function OngletProfil() {
  const { user } = useAuthContext()
  const modifier = useModifierProfil()

  const parties = (user?.fullName ?? "").trim().split(/\s+/)
  const [nom, setNom] = useState(parties[0] ?? "")
  const [prenom, setPrenom] = useState(parties.slice(1).join(" "))
  const [email, setEmail] = useState(user?.email ?? "")
  const [mdp, setMdp] = useState("")
  const [mdpConfirm, setMdpConfirm] = useState("")
  const [succes, setSucces] = useState(false)
  const [erreur, setErreur] = useState("")

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreur("")
    setSucces(false)

    if (!nom.trim() || !prenom.trim()) return setErreur("Nom et prénom sont requis.")
    if (!email.trim()) return setErreur("L'adresse e-mail est requise.")
    if (mdp && mdp !== mdpConfirm) return setErreur("Les mots de passe ne correspondent pas.")
    if (mdp && mdp.length < 8) return setErreur("Le mot de passe doit avoir au moins 8 caractères.")

    modifier.mutate(
      { nom: nom.trim(), prenom: prenom.trim(), email: email.trim(), mot_de_passe: mdp || undefined },
      {
        onSuccess: () => { setSucces(true); setMdp(""); setMdpConfirm("") },
        onError: (err) => setErreur(err.message),
      }
    )
  }

  return (
    <form onSubmit={soumettre} className="max-w-lg space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Camara" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Alpha" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="rounded-[3px] border border-border p-4 space-y-4">
        <p className="text-sm font-medium">Changer le mot de passe <span className="text-muted-foreground font-normal">(optionnel)</span></p>
        <div className="space-y-1.5">
          <Label htmlFor="mdp">Nouveau mot de passe</Label>
          <Input id="mdp" type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="8 caractères minimum" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mdp2">Confirmer le mot de passe</Label>
          <Input id="mdp2" type="password" value={mdpConfirm} onChange={(e) => setMdpConfirm(e.target.value)} />
        </div>
      </div>

      {succes && <MessageSucces texte="Profil mis à jour avec succès." />}
      {erreur && <MessageErreur texte={erreur} />}

      <Button type="submit" disabled={modifier.isPending}>
        {modifier.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
      </Button>
    </form>
  )
}

// ── Onglet Entreprise ─────────────────────────────────────────────────────────

function OngletEntreprise() {
  const { data: entreprise, isLoading } = useEntreprise()
  const modifier = useModifierEntreprise()

  const [nom, setNom] = useState("")
  const [succes, setSucces] = useState(false)
  const [erreur, setErreur] = useState("")

  // Pré-remplir quand les données arrivent
  const nomActuel = entreprise?.nom_entreprise ?? ""

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreur("")
    setSucces(false)

    const valeur = nom.trim() || nomActuel
    if (!valeur) return setErreur("Le nom de l'entreprise est requis.")

    modifier.mutate(
      { nom_entreprise: valeur },
      {
        onSuccess: () => setSucces(true),
        onError: (err) => setErreur(err.message),
      }
    )
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>

  return (
    <form onSubmit={soumettre} className="max-w-lg space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="nomEntreprise">Nom de l'entreprise</Label>
        <Input
          id="nomEntreprise"
          placeholder={nomActuel}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Nom actuel : <span className="font-medium">{nomActuel}</span>
        </p>
      </div>

      {succes && <MessageSucces texte="Informations de l'entreprise mises à jour." />}
      {erreur && <MessageErreur texte={erreur} />}

      <Button type="submit" disabled={modifier.isPending}>
        {modifier.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
      </Button>
    </form>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export function ParametresPage() {
  const { estAdmin } = useRole()
  const [onglet, setOnglet] = useState<Onglet>("profil")

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Configuration</p>
        <h2 className="text-2xl font-semibold">Paramètres</h2>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 rounded-[3px] border border-border bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setOnglet("profil")}
          className={`flex items-center gap-2 rounded-[3px] px-4 py-2 text-sm font-medium transition ${
            onglet === "profil"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          Mon profil
        </button>
        {estAdmin && (
          <button
            type="button"
            onClick={() => setOnglet("entreprise")}
            className={`flex items-center gap-2 rounded-[3px] px-4 py-2 text-sm font-medium transition ${
              onglet === "entreprise"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Mon entreprise
          </button>
        )}
      </div>

      {/* Contenu */}
      <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
        {onglet === "profil" && <OngletProfil />}
        {onglet === "entreprise" && estAdmin && <OngletEntreprise />}
      </div>
    </div>
  )
}
