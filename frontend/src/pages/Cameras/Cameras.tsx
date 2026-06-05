import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { useRole } from "@/hooks/useRole"
import {
  recupererBureaux,
  type Bureau,
} from "@/pages/Bureaux/services/bureau.service"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { CameraStatusCard } from "./components/CameraStatusCard"
import { useCameras } from "./hooks/useCameras"
import { useCreerCamera } from "./hooks/useCreerCamera"

export function CamerasPage() {
  const { estAdmin } = useRole()
  const { data, isLoading, error } = useCameras()
  const creer = useCreerCamera()

  const [modalOuvert, setModalOuvert] = useState(false)
  const [bureaux, setBureaux] = useState<Bureau[]>([])
  const [form, setForm] = useState({
    bureauId: "",
    identifiantMqtt: "",
    adresseIp: "",
    resolution: "640x480",
  })
  const [erreur, setErreur] = useState("")

  useEffect(() => {
    if (modalOuvert)
      recupererBureaux()
        .then((bs) => setBureaux(bs.filter((b) => b.etat)))
        .catch(() => {})
  }, [modalOuvert])

  function soumettre() {
    if (!form.bureauId) return setErreur("Sélectionnez un bureau.")
    if (!form.identifiantMqtt.trim())
      return setErreur("L'identifiant MQTT est requis.")
    creer.mutate(
      {
        bureauId: Number(form.bureauId),
        identifiantMqtt: form.identifiantMqtt.trim(),
        adresseIp: form.adresseIp || undefined,
        resolution: form.resolution,
      },
      {
        onSuccess: () => {
          setModalOuvert(false)
          setForm({
            bureauId: "",
            identifiantMqtt: "",
            adresseIp: "",
            resolution: "640x480",
          })
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
          <p className="text-sm font-medium text-muted-foreground">Caméras</p>
          <h2 className="text-2xl font-semibold">Supervision des caméras</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Suivez l'état en ligne, prenez des snapshots et gérez
            l'enregistrement en temps réel.
          </p>
        </div>
        {estAdmin && (
          <Button onClick={() => setModalOuvert(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Ajouter une caméra
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          Chargement des caméras...
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune caméra enregistrée.
          {estAdmin
            ? " Cliquez sur « Ajouter une caméra » pour commencer."
            : ""}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {data?.map((camera) => (
          <CameraStatusCard key={camera.id} camera={camera} />
        ))}
      </div>

      <Modal
        ouvert={modalOuvert}
        onFermer={() => setModalOuvert(false)}
        titre="Ajouter une caméra"
      >
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
                <option key={b.id} value={b.id}>
                  {b.nomBureau}
                  {b.etage ? ` — ${b.etage}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Identifiant MQTT</Label>
            <Input
              placeholder="ex : camera-bureau-1"
              value={form.identifiantMqtt}
              onChange={(e) =>
                setForm({ ...form, identifiantMqtt: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Adresse IP de l'ESP32-CAM</Label>
            <Input
              placeholder="ex : 192.168.1.50"
              value={form.adresseIp}
              onChange={(e) => setForm({ ...form, adresseIp: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Le lien du flux sera généré automatiquement.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Résolution</Label>
            <select
              className="w-full rounded-[3px] border border-input bg-background px-3 py-2 text-sm"
              value={form.resolution}
              onChange={(e) => setForm({ ...form, resolution: e.target.value })}
            >
              <option value="640x480">640×480 (VGA)</option>
              <option value="320x240">320×240 (QVGA)</option>
              <option value="1280x720">1280×720 (HD)</option>
            </select>
          </div>
          {erreur && <p className="text-sm text-destructive">{erreur}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOuvert(false)}>
              Annuler
            </Button>
            <Button onClick={soumettre} disabled={creer.isPending}>
              {creer.isPending ? "Création..." : "Créer la caméra"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
