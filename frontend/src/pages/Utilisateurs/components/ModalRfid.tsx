import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CreditCard, Plus, Trash2, WifiOff } from "lucide-react"
import { useState } from "react"
import {
  basculerEtatCarte,
  creerCarteRfid,
  recupererCartesRfid,
  supprimerCarteRfid,
} from "../services/rfid.service"
import { type Utilisateur } from "@/types/user"

type Props = {
  utilisateur: Utilisateur
  onFermer: () => void
}

export function ModalRfid({ utilisateur, onFermer }: Props) {
  const qc = useQueryClient()
  const [uid, setUid] = useState("")
  const [erreur, setErreur] = useState("")

  const { data: toutesCartes = [] } = useQuery({
    queryKey: ["cartes-rfid"],
    queryFn: recupererCartesRfid,
  })

  const cartes = toutesCartes.filter(
    (c) => String(c.utilisateur_id) === utilisateur.id
  )

  const ajouter = useMutation({
    mutationFn: () => creerCarteRfid(Number(utilisateur.id), uid.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartes-rfid"] })
      setUid("")
      setErreur("")
    },
    onError: (e) => setErreur(e instanceof Error ? e.message : "Erreur"),
  })

  const supprimer = useMutation({
    mutationFn: supprimerCarteRfid,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartes-rfid"] }),
  })

  const basculer = useMutation({
    mutationFn: ({ id, etat }: { id: number; etat: boolean }) =>
      basculerEtatCarte(id, etat),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartes-rfid"] }),
  })

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreur("")
    if (!uid.trim()) return setErreur("L'UID de la carte est requis.")
    if (uid.trim().length < 4) return setErreur("UID trop court (min. 4 caractères).")
    ajouter.mutate()
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={`Cartes RFID — ${utilisateur.fullName}`}
    >
      <div className="space-y-5">
        {/* Formulaire ajout */}
        <form onSubmit={soumettre} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="uid-carte">UID de la carte</Label>
            <div className="flex gap-2">
              <Input
                id="uid-carte"
                placeholder="ex: A3F2B1C4"
                value={uid}
                onChange={(e) => { setUid(e.target.value); setErreur("") }}
                className="font-mono"
              />
              <Button type="submit" disabled={ajouter.isPending} className="shrink-0 gap-1.5">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Saisissez l'UID affiché sur la carte ou lu par le lecteur RC522/PN532.
            </p>
          </div>
          {erreur && <p className="text-sm text-destructive">{erreur}</p>}
        </form>

        {/* Liste cartes */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Cartes associées{" "}
            <span className="text-muted-foreground">({cartes.length})</span>
          </p>

          {cartes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune carte RFID associée à cet utilisateur.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-[3px] border border-border overflow-hidden">
              {cartes.map((carte) => (
                <div
                  key={carte.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <CreditCard
                    className={`h-4 w-4 shrink-0 ${
                      carte.etat ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{carte.uid_carte}</p>
                    <p className="text-xs text-muted-foreground">
                      {carte.etat ? "Active" : "Désactivée"} · Ajoutée le{" "}
                      {new Date(carte.date_creation).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={carte.etat ? "Désactiver" : "Activer"}
                      disabled={basculer.isPending}
                      onClick={() =>
                        basculer.mutate({ id: carte.id, etat: !carte.etat })
                      }
                    >
                      <WifiOff
                        className={`h-4 w-4 ${
                          carte.etat ? "text-muted-foreground" : "text-destructive"
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Supprimer"
                      disabled={supprimer.isPending}
                      onClick={() => supprimer.mutate(carte.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onFermer}>Fermer</Button>
        </div>
      </div>
    </Modal>
  )
}
