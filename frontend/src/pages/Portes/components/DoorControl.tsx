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

type Props = { door: Door }

export function DoorControl({ door }: Props) {
  const { estAdmin } = useRole()
  const [modalOuvert, setModalOuvert] = useState(false)
  const [pin, setPin] = useState("")
  const [erreurPin, setErreurPin] = useState("")

  const commander = useCommanderPorte()
  const supprimer = useSupprimerPorte()

  const actionSouhaitee: "ouvrir" | "fermer" =
    door.state === "ouverte" ? "fermer" : "ouvrir"

  function ouvrirModal() {
    setPin("")
    setErreurPin("")
    setModalOuvert(true)
  }

  function envoyerCommande() {
    if (pin.trim().length < 4) {
      setErreurPin("Le code PIN doit contenir au moins 4 chiffres.")
      return
    }
    commander.mutate(
      { id: door.rawId, action: actionSouhaitee, codePIN: pin },
      {
        onSuccess: () => setModalOuvert(false),
        onError: (err) => setErreurPin(err.message),
      }
    )
  }

  return (
    <>
      <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Porte
            </p>
            <h3 className="mt-1 text-lg font-semibold">{door.name}</h3>
            <p className="text-sm text-muted-foreground">{door.location}</p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-sm font-medium ${
              door.state === "ouverte"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {door.state === "ouverte" ? (
              <Unlock className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            {door.state === "ouverte" ? "Ouverte" : "Verrouillée"}
          </div>
        </div>

        {/* Activité + actions */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Dernière activité : {door.lastActivity}
          </p>
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
              onClick={ouvrirModal}
            >
              <KeyRound className="h-4 w-4" />
              {door.state === "ouverte" ? "Fermer" : "Ouvrir"}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal PIN */}
      <Modal
        ouvert={modalOuvert}
        onFermer={() => setModalOuvert(false)}
        titre={`${actionSouhaitee === "ouvrir" ? "Ouvrir" : "Fermer"} — ${door.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Entrez votre code PIN pour{" "}
            {actionSouhaitee === "ouvrir" ? "ouvrir" : "fermer"} cette porte.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pin">Code PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setErreurPin("")
              }}
              onKeyDown={(e) => e.key === "Enter" && envoyerCommande()}
              autoFocus
            />
            {erreurPin && (
              <p className="text-sm text-destructive">{erreurPin}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOuvert(false)}>
              Annuler
            </Button>
            <Button onClick={envoyerCommande} disabled={commander.isPending}>
              {commander.isPending ? "Envoi..." : "Confirmer"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
