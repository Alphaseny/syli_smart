import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { useRole } from "@/hooks/useRole"
import { recupererBureaux, type Bureau } from "@/pages/Bureaux/services/bureau.service"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { CameraStatusCard } from "./components/CameraStatusCard"
import { useCameras } from "./hooks/useCameras"
import { useCreerCamera } from "./hooks/useCreerCamera"

type TypeCamera = "jortan" | "esp32cam" | "generique" | "custom"

type FormState = {
  bureauId: string
  identifiantMqtt: string
  adresseIp: string
  resolution: string
  typeCamera: TypeCamera
  login: string
  motDePasse: string
  lienFluxCustom: string
  lienSnapshotCustom: string
}

const ETAT_INITIAL: FormState = {
  bureauId: "",
  identifiantMqtt: "",
  adresseIp: "",
  resolution: "640x480",
  typeCamera: "jortan",
  login: "admin",
  motDePasse: "",
  lienFluxCustom: "",
  lienSnapshotCustom: "",
}

function genererUrls(
  type: TypeCamera,
  ip: string,
  login: string,
  mdp: string,
): { flux: string; snapshot: string } {
  if (!ip || type === "custom") return { flux: "", snapshot: "" }

  const authParam =
    login && mdp
      ? `?loginuse=${encodeURIComponent(login)}&loginpas=${encodeURIComponent(mdp)}`
      : ""

  switch (type) {
    case "jortan":
      return {
        flux: authParam
          ? `http://${ip}/videostream.cgi${authParam}&resolution=32&rate=0`
          : `http://${ip}/videostream.cgi`,
        snapshot: `http://${ip}/snapshot.cgi${authParam}`,
      }
    case "esp32cam":
      return {
        flux: `http://${ip}/stream`,
        snapshot: `http://${ip}/capture`,
      }
    case "generique":
      return {
        flux: `http://${ip}/video`,
        snapshot: `http://${ip}/snapshot`,
      }
  }
}

const LABELS_TYPE: Record<TypeCamera, string> = {
  jortan: "Jortan (caméra IP bureau)",
  esp32cam: "ESP32-CAM",
  generique: "IP Camera générique",
  custom: "Personnalisée (URLs manuelles)",
}

export function CamerasPage() {
  const { estAdmin } = useRole()
  const { data, isLoading, error } = useCameras()
  const creer = useCreerCamera()

  const [modalOuvert, setModalOuvert] = useState(false)
  const [bureaux, setBureaux] = useState<Bureau[]>([])
  const [form, setForm] = useState<FormState>(ETAT_INITIAL)
  const [erreur, setErreur] = useState("")

  useEffect(() => {
    if (modalOuvert)
      recupererBureaux()
        .then((bs) => setBureaux(bs.filter((b) => b.etat)))
        .catch(() => {})
  }, [modalOuvert])

  function maj<K extends keyof FormState>(champ: K, valeur: FormState[K]) {
    setForm((f) => ({ ...f, [champ]: valeur }))
    setErreur("")
  }

  const { flux: lienFluxAuto, snapshot: lienSnapshotAuto } = genererUrls(
    form.typeCamera,
    form.adresseIp,
    form.login,
    form.motDePasse,
  )

  function soumettre() {
    if (!form.bureauId) return setErreur("Sélectionnez un bureau.")
    if (!form.identifiantMqtt.trim()) return setErreur("L'identifiant MQTT est requis.")

    const lienFlux =
      form.typeCamera === "custom" ? form.lienFluxCustom || undefined : lienFluxAuto || undefined
    const lienSnapshot =
      form.typeCamera === "custom"
        ? form.lienSnapshotCustom || undefined
        : lienSnapshotAuto || undefined

    creer.mutate(
      {
        bureauId: Number(form.bureauId),
        identifiantMqtt: form.identifiantMqtt.trim(),
        adresseIp: form.adresseIp || undefined,
        resolution: form.resolution,
        lienFluxVideo: lienFlux,
        lienSnapshot,
      },
      {
        onSuccess: () => {
          setModalOuvert(false)
          setForm(ETAT_INITIAL)
          setErreur("")
        },
        onError: (err) => setErreur(err.message),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Caméras</p>
          <h2 className="text-2xl font-semibold">Supervision des caméras</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Surveillez vos bureaux en temps réel. Cliquez sur une caméra en ligne pour
            ouvrir le flux vidéo direct depuis n'importe quel appareil.
          </p>
        </div>
        {estAdmin && (
          <Button onClick={() => setModalOuvert(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Ajouter une caméra
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Chargement des caméras...</p>
      )}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune caméra enregistrée.
          {estAdmin ? " Cliquez sur « Ajouter une caméra » pour commencer." : ""}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {data?.map((camera) => (
          <CameraStatusCard key={camera.id} camera={camera} />
        ))}
      </div>

      {/* Modal d'ajout */}
      <Modal
        ouvert={modalOuvert}
        onFermer={() => { setModalOuvert(false); setForm(ETAT_INITIAL); setErreur("") }}
        titre="Ajouter une caméra"
      >
        <div className="space-y-4">
          {/* Bureau */}
          <div className="space-y-1.5">
            <Label>Bureau</Label>
            <select
              className="w-full rounded-[3px] border border-input bg-background px-3 py-2 text-sm"
              value={form.bureauId}
              onChange={(e) => maj("bureauId", e.target.value)}
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

          {/* Identifiant MQTT */}
          <div className="space-y-1.5">
            <Label>Identifiant MQTT</Label>
            <Input
              placeholder="ex : camera-bureau-1"
              value={form.identifiantMqtt}
              onChange={(e) => maj("identifiantMqtt", e.target.value)}
            />
          </div>

          {/* Type de caméra */}
          <div className="space-y-1.5">
            <Label>Marque / Type</Label>
            <select
              className="w-full rounded-[3px] border border-input bg-background px-3 py-2 text-sm"
              value={form.typeCamera}
              onChange={(e) => maj("typeCamera", e.target.value as TypeCamera)}
            >
              {(Object.entries(LABELS_TYPE) as [TypeCamera, string][]).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Adresse IP */}
          <div className="space-y-1.5">
            <Label>Adresse IP de la caméra</Label>
            <Input
              placeholder="ex : 192.168.1.50"
              value={form.adresseIp}
              onChange={(e) => maj("adresseIp", e.target.value)}
            />
          </div>

          {/* Login / Mot de passe (Jortan & générique) */}
          {form.typeCamera !== "esp32cam" && form.typeCamera !== "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Login caméra</Label>
                <Input
                  placeholder="admin"
                  value={form.login}
                  onChange={(e) => maj("login", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mot de passe</Label>
                <Input
                  type="password"
                  placeholder="(vide si non requis)"
                  value={form.motDePasse}
                  onChange={(e) => maj("motDePasse", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Aperçu des URLs générées */}
          {form.typeCamera !== "custom" && form.adresseIp && (
            <div className="rounded-[3px] border border-border bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-medium text-muted-foreground">URLs générées automatiquement</p>
              <p className="break-all text-foreground">
                <span className="text-muted-foreground">Flux :</span> {lienFluxAuto || "—"}
              </p>
              <p className="break-all text-foreground">
                <span className="text-muted-foreground">Snapshot :</span> {lienSnapshotAuto || "—"}
              </p>
            </div>
          )}

          {/* URLs personnalisées */}
          {form.typeCamera === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label>URL flux MJPEG</Label>
                <Input
                  placeholder="http://192.168.1.50/stream"
                  value={form.lienFluxCustom}
                  onChange={(e) => maj("lienFluxCustom", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL snapshot</Label>
                <Input
                  placeholder="http://192.168.1.50/capture"
                  value={form.lienSnapshotCustom}
                  onChange={(e) => maj("lienSnapshotCustom", e.target.value)}
                />
              </div>
            </>
          )}

          {/* Résolution */}
          <div className="space-y-1.5">
            <Label>Résolution</Label>
            <select
              className="w-full rounded-[3px] border border-input bg-background px-3 py-2 text-sm"
              value={form.resolution}
              onChange={(e) => maj("resolution", e.target.value)}
            >
              <option value="640x480">640×480 (VGA)</option>
              <option value="320x240">320×240 (QVGA)</option>
              <option value="1280x720">1280×720 (HD)</option>
            </select>
          </div>

          {erreur && <p className="text-sm text-destructive">{erreur}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setModalOuvert(false); setForm(ETAT_INITIAL); setErreur("") }}
            >
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
