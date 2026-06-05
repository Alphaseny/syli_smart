import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { useRole } from "@/hooks/useRole"
import { recupererBureaux, type Bureau } from "@/pages/Bureaux/services/bureau.service"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { DoorControl } from "./components/DoorControl"
import { useCreerPorte } from "./hooks/useCreerPorte"
import { usePortes } from "./hooks/usePortes"

export function PortesPage() {
  const { estAdmin } = useRole()
  const { data, isLoading, error } = usePortes()
  const creer = useCreerPorte()

  const [modalOuvert, setModalOuvert] = useState(false)
  const [bureaux, setBureaux] = useState<Bureau[]>([])
  const [form, setForm] = useState({
    bureauId: "",
    identifiantMqtt: "",
    modeOuverture: "distance",
    dureeOuvertureSec: 5,
    codePinInitial: "",
  })
  const [erreur, setErreur] = useState("")

  useEffect(() => {
    if (modalOuvert) {
      recupererBureaux().then((bs) => setBureaux(bs.filter((b) => b.etat))).catch(() => {})
    }
  }, [modalOuvert])

  function soumettre() {
    if (!form.bureauId) return setErreur("Sélectionnez un bureau.")
    if (!form.identifiantMqtt.trim()) return setErreur("L'identifiant MQTT est requis.")
    if (form.codePinInitial.length < 4) return setErreur("Le code PIN doit avoir au moins 4 chiffres.")

    creer.mutate(
      {
        bureauId: Number(form.bureauId),
        identifiantMqtt: form.identifiantMqtt.trim(),
        modeOuverture: form.modeOuverture,
        dureeOuvertureSec: form.dureeOuvertureSec,
        codePinInitial: form.codePinInitial,
      },
      {
        onSuccess: () => {
          setModalOuvert(false)
          setForm({ bureauId: "", identifiantMqtt: "", modeOuverture: "distance", dureeOuvertureSec: 5, codePinInitial: "" })
          setErreur("")
        },
        onError: (err) => setErreur(err.message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Portes</p>
          <h2 className="text-2xl font-semibold">Contrôle des accès</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Ouvrez ou fermez les portes avec votre code PIN. Les commandes sont envoyées en temps réel via MQTT.
          </p>
        </div>
        {estAdmin && (
          <Button onClick={() => setModalOuvert(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Ajouter une porte
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement des portes...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune porte enregistrée.{estAdmin ? " Cliquez sur « Ajouter une porte » pour commencer." : ""}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.map((door) => <DoorControl key={door.id} door={door} />)}
      </div>

      {/* Modal création porte (admin) */}
      <Modal ouvert={modalOuvert} onFermer={() => setModalOuvert(false)} titre="Ajouter une porte">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bureau</Label>
            <select
              className="w-full rounded-[3px] border border-input bg-background px-3 py-2 text-sm"
              value={form.bureauId}
              onChange={(e) => setForm({ ...form, bureauId: e.target.value })}
            >
              <option value="">-- Sélectionner --</option>
              {bureaux.map((b) => (
                <option key={b.id} value={b.id}>{b.nomBureau}{b.etage ? ` — ${b.etage}` : ""}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Identifiant MQTT</Label>
            <Input
              placeholder="ex : porte-bureau-1"
              value={form.identifiantMqtt}
              onChange={(e) => setForm({ ...form, identifiantMqtt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Doit correspondre exactement au firmware ESP8266.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Mode d'ouverture</Label>
            <select
              className="w-full rounded-[3px] border border-input bg-background px-3 py-2 text-sm"
              value={form.modeOuverture}
              onChange={(e) => setForm({ ...form, modeOuverture: e.target.value })}
            >
              <option value="distance">À distance (application)</option>
              <option value="manuel">Manuel (code PIN physique)</option>
              <option value="automatique">Automatique (capteur)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Durée d'ouverture (secondes)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={form.dureeOuvertureSec}
              onChange={(e) => setForm({ ...form, dureeOuvertureSec: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Code PIN initial</Label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="ex : 1234"
              value={form.codePinInitial}
              onChange={(e) => setForm({ ...form, codePinInitial: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Ce code sera haché et stocké en base de données.</p>
          </div>

          {erreur && <p className="text-sm text-destructive">{erreur}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOuvert(false)}>Annuler</Button>
            <Button onClick={soumettre} disabled={creer.isPending}>
              {creer.isPending ? "Création..." : "Créer la porte"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
