import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { useRole } from "@/hooks/useRole"
import { type Door } from "@/types/door"
import { KeyRound, Lock, Trash2, Unlock } from "lucide-react"
import { useState } from "react"
import { useCommanderPorte } from "../hooks/useCommanderPorte"
import { useSupprimerPorte } from "../hooks/useSupprimerPorte"
import { ModalCamera } from "./ModalCamera"

type Etape = "repos" | "camera" | "pin"

type Props = { door: Door }

export function DoorControl({ door }: Props) {
  const { estAdmin } = useRole()
  const [etape, setEtape] = useState<Etape>("repos")
  const [pin, setPin] = useState("")
  const [erreurPin, setErreurPin] = useState("")
  const [messageSucces, setMessageSucces] = useState("")

  const commander = useCommanderPorte()
  const supprimer = useSupprimerPorte()

  // "Fermer" ne passe pas par la caméra → directement PIN
  function clicBouton() {
    setMessageSucces("")
    setPin("")
    setErreurPin("")
    if (door.state === "ouverte") {
      setEtape("pin")
    } else {
      // "Ouvrir" → essai reconnaissance faciale en premier
      setEtape("camera")
    }
  }

  // Reconnaissance réussie — porte déjà ouverte par le backend
  function surReconnaissanceReussie(nom: string) {
    setMessageSucces(`Bonjour ${nom} — porte ouverte.`)
    setEtape("repos")
  }

  // Reconnaissance échouée → bascule sur le PIN
  function surEchecReconnaissance() {
    setPin("")
    setErreurPin("")
    setEtape("pin")
  }

  // Envoi de la commande via PIN
  function envoyerCommandePin() {
    if (pin.trim().length < 4) {
      setErreurPin("Le code PIN doit contenir au moins 4 chiffres.")
      return
    }
    const action = door.state === "ouverte" ? "fermer" : "ouvrir"
    commander.mutate(
      { id: door.rawId, action, codePIN: pin },
      {
        onSuccess: () => { setEtape("repos"); setMessageSucces("") },
        onError: (err) => setErreurPin(err.message),
      }
    )
  }

  const labelBouton = door.state === "ouverte" ? "Fermer" : "Ouvrir"

  return (
    <>
      {/* ── Carte porte ───────────────────────────────────────────────── */}
      <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Porte</p>
            <h3 className="mt-1 text-lg font-semibold">{door.name}</h3>
            <p className="text-sm text-muted-foreground">{door.location}</p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-sm font-medium ${
            door.state === "ouverte"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-secondary text-secondary-foreground"
          }`}>
            {door.state === "ouverte"
              ? <Unlock className="h-3.5 w-3.5" />
              : <Lock className="h-3.5 w-3.5" />}
            {door.state === "ouverte" ? "Ouverte" : "Verrouillée"}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Dernière activité : {door.lastActivity}
            </p>
            {messageSucces && (
              <p className="mt-1 text-xs font-medium text-green-600">{messageSucces}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {estAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => supprimer.mutate(door.rawId)}
                disabled={supprimer.isPending}
                title="Supprimer cette porte"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <Button
              variant={door.state === "ouverte" ? "outline" : "default"}
              size="sm"
              onClick={clicBouton}
            >
              <KeyRound className="h-4 w-4" />
              {labelBouton}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Étape 1 : Caméra (reconnaissance faciale) ─────────────────── */}
      {etape === "camera" && (
        <ModalCamera
          door={door}
          onSucces={surReconnaissanceReussie}
          onBasculerPin={surEchecReconnaissance}
          onFermer={() => setEtape("repos")}
        />
      )}

      {/* ── Étape 2 : Code PIN (fallback ou "Fermer") ─────────────────── */}
      {etape === "pin" && (
        <Modal
          ouvert
          onFermer={() => setEtape("repos")}
          titre={`${door.state === "ouverte" ? "Fermer" : "Ouvrir"} — ${door.name}`}
        >
          <div className="space-y-4">
            {door.state !== "ouverte" && (
              <p className="rounded-[3px] bg-muted px-3 py-2 text-xs text-muted-foreground">
                La reconnaissance faciale n'a pas abouti. Entrez votre code PIN.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pin">Code PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setErreurPin("") }}
                onKeyDown={(e) => e.key === "Enter" && envoyerCommandePin()}
                autoFocus
              />
              {erreurPin && <p className="text-sm text-destructive">{erreurPin}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEtape("repos")}>Annuler</Button>
              <Button onClick={envoyerCommandePin} disabled={commander.isPending}>
                {commander.isPending ? "Envoi..." : "Confirmer"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
