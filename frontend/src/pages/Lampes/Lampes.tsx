import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { useLampesWebSocket } from "@/hooks/useLampesWebSocket"
import { useRole } from "@/hooks/useRole"
import { recupererBureaux, type Bureau } from "@/pages/Bureaux/services/bureau.service"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { LampeControl } from "./components/LampeControl"
import { useCreerLampe } from "./hooks/useCreerLampe"
import { useLampes } from "./hooks/useLampes"

export function LampesPage() {
  const { estAdmin } = useRole()
  const { data, isLoading, error } = useLampes()
  useLampesWebSocket() // mise à jour temps réel via WebSocket
  const creer = useCreerLampe()

  const [modalOuvert, setModalOuvert] = useState(false)
  const [bureaux, setBureaux] = useState<Bureau[]>([])
  const [form, setForm] = useState({
    bureauId: "",
    identifiantMqtt: "",
    intensitePct: 100,
    modeAuto: false,
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

    creer.mutate(
      {
        bureauId: Number(form.bureauId),
        identifiantMqtt: form.identifiantMqtt.trim(),
        intensitePct: form.intensitePct,
        modeAuto: form.modeAuto,
      },
      {
        onSuccess: () => {
          setModalOuvert(false)
          setForm({ bureauId: "", identifiantMqtt: "", intensitePct: 100, modeAuto: false })
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
          <p className="text-sm font-medium text-muted-foreground">Lampes</p>
          <h2 className="text-2xl font-semibold">Gestion de l'éclairage</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Allumez ou éteignez les lampes depuis l'application. Les commandes sont envoyées en temps réel via MQTT.
          </p>
        </div>
        {estAdmin && (
          <Button onClick={() => setModalOuvert(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Ajouter une lampe
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement des lampes...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune lampe enregistrée.{estAdmin ? " Cliquez sur « Ajouter une lampe » pour commencer." : ""}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {data?.map((lamp) => <LampeControl key={lamp.id} lampe={lamp} />)}
      </div>

      {/* Modal création lampe (admin) */}
      <Modal ouvert={modalOuvert} onFermer={() => setModalOuvert(false)} titre="Ajouter une lampe">
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
              placeholder="ex : lampe-bureau-1"
              value={form.identifiantMqtt}
              onChange={(e) => setForm({ ...form, identifiantMqtt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Doit correspondre exactement au firmware ESP8266.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Intensité par défaut (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.intensitePct}
              onChange={(e) => setForm({ ...form, intensitePct: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="modeAuto"
              checked={form.modeAuto}
              onChange={(e) => setForm({ ...form, modeAuto: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="modeAuto">Mode automatique (détecteur PIR)</Label>
          </div>

          {erreur && <p className="text-sm text-destructive">{erreur}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOuvert(false)}>Annuler</Button>
            <Button onClick={soumettre} disabled={creer.isPending}>
              {creer.isPending ? "Création..." : "Créer la lampe"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
