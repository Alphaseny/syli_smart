import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { type Utilisateur } from "@/types/user"
import { Camera, CheckCircle, Upload, X } from "lucide-react"
import { useRef, useState } from "react"
import { enregistrerVisage, supprimerVisage } from "../services/reconnaissance.service"

type Props = {
  utilisateur: Utilisateur | null
  estEnrole: boolean
  onFermer: () => void
  onSucces: () => void
}

export function ModalEnregistrementVisage({ utilisateur, estEnrole, onFermer, onSucces }: Props) {
  const [fichier, setFichier] = useState<File | null>(null)
  const [apercu, setApercu] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)
  const [message, setMessage] = useState("")
  const [erreur, setErreur] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  if (!utilisateur) return null

  function selectionnerFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFichier(f)
    setApercu(URL.createObjectURL(f))
    setErreur("")
    setMessage("")
  }

  async function soumettre() {
    if (!fichier) return setErreur("Sélectionnez une photo.")
    setChargement(true)
    setErreur("")
    try {
      const res = await enregistrerVisage(utilisateur!.id, fichier)
      setMessage(res.message)
      setTimeout(() => { onSucces(); onFermer() }, 1500)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.")
    } finally {
      setChargement(false)
    }
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le visage de ${utilisateur!.fullName} ?`)) return
    setChargement(true)
    try {
      await supprimerVisage(utilisateur!.id)
      onSucces()
      onFermer()
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur lors de la suppression.")
    } finally {
      setChargement(false)
    }
  }

  return (
    <Modal
      ouvert={true}
      onFermer={onFermer}
      titre={`Reconnaissance faciale — ${utilisateur.fullName}`}
    >
      <div className="space-y-4">
        {estEnrole && !fichier && (
          <div className="flex items-center gap-2 rounded-[3px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Visage déjà enregistré. Importez une nouvelle photo pour le remplacer.
          </div>
        )}

        {/* Zone d'upload */}
        <div
          className="cursor-pointer rounded-[3px] border-2 border-dashed border-border p-6 text-center transition hover:border-primary hover:bg-muted/50"
          onClick={() => inputRef.current?.click()}
        >
          {apercu ? (
            <div className="flex flex-col items-center gap-3">
              <img src={apercu} alt="Aperçu" className="h-40 w-40 rounded-full object-cover shadow" />
              <p className="text-sm text-muted-foreground">{fichier?.name}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="h-10 w-10 opacity-40" />
              <p className="text-sm font-medium">Cliquez pour importer une photo</p>
              <p className="text-xs">JPEG ou PNG — visage bien visible, bon éclairage</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={selectionnerFichier}
        />

        {message && (
          <div className="flex items-center gap-2 rounded-[3px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" /> {message}
          </div>
        )}
        {erreur && (
          <div className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {erreur}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            {estEnrole && (
              <Button variant="outline" size="sm" onClick={supprimer} disabled={chargement}>
                <X className="h-4 w-4 text-destructive" /> Supprimer le visage
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFermer}>Annuler</Button>
            <Button onClick={soumettre} disabled={!fichier || chargement}>
              <Upload className="h-4 w-4" />
              {chargement ? "Traitement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
