import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { type Door } from "@/types/door"
import { Camera, CheckCircle, KeyRound, Loader2, ScanFace, XCircle } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { identifierVisageLive } from "../services/door.service"
import { useQueryClient } from "@tanstack/react-query"
import { useRole } from "@/hooks/useRole"

type EtatCamera =
  | "demarrage"
  | "pret"
  | "analyse"
  | "nouvelle_tentative"
  | "succes"
  | "echec"
  | "erreur_camera"

type Props = {
  door: Door
  onSucces: (nom: string) => void
  onBasculerPin: () => void
  onFermer: () => void
}

const DECOMPTE_INITIAL = 3   // secondes avant auto-capture
const MAX_TENTATIVES = 2     // 1 essai + 1 retry sur "aucun visage"
const DELAI_RETRY_MS = 1500  // pause avant relance automatique

/** Retourne false si l'image est trop sombre ou trop surexposee */
function luminositeSuffisante(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d")
  if (!ctx) return true
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
  }
  const moy = total / (data.length / 4)
  return moy >= 35 && moy <= 235
}

export function ModalCamera({ door, onSucces, onBasculerPin, onFermer }: Props) {
  const { entrepriseId } = useRole()
  const qc = useQueryClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [etat, setEtat] = useState<EtatCamera>("demarrage")
  const [message, setMessage] = useState("")
  const [decompte, setDecompte] = useState(DECOMPTE_INITIAL)

  // Ref pour eviter les appels doubles et les closures perimees
  const tentativeRef = useRef(0)
  const enCoursRef = useRef(false)
  const analyserRef = useRef<() => void>(() => {})

  const stopperCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  function fermer() {
    stopperCamera()
    onFermer()
  }

  // ── Demarrage camera ────────────────────────────────────────────────────────
  useEffect(() => {
    let annule = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      .then((stream) => {
        if (annule) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        setEtat("pret")
      })
      .catch(() => {
        if (!annule) setEtat("erreur_camera")
      })
    return () => { annule = true; stopperCamera() }
  }, [stopperCamera])

  // ── Decompte + auto-capture des que la camera est prete ────────────────────
  useEffect(() => {
    if (etat !== "pret") return
    let count = DECOMPTE_INITIAL
    setDecompte(count)

    const tick = setInterval(() => {
      count -= 1
      setDecompte(count)
      if (count <= 0) clearInterval(tick)
    }, 1000)

    // Utilise le ref pour appeler toujours la version la plus recente d'analyser
    const capture = setTimeout(() => analyserRef.current(), DECOMPTE_INITIAL * 1000)

    return () => { clearInterval(tick); clearTimeout(capture) }
  }, [etat])

  // ── Pause entre deux tentatives ─────────────────────────────────────────────
  useEffect(() => {
    if (etat !== "nouvelle_tentative") return
    const timer = setTimeout(() => {
      enCoursRef.current = false
      setEtat("pret")
    }, DELAI_RETRY_MS)
    return () => clearTimeout(timer)
  }, [etat])

  // ── Erreur camera → bascule automatiquement sur PIN apres 2 s ───────────────
  useEffect(() => {
    if (etat !== "erreur_camera") return
    const timer = setTimeout(() => onBasculerPin(), 2000)
    return () => clearTimeout(timer)
  }, [etat, onBasculerPin])

  // ── Echec reconnu → bascule automatiquement sur PIN apres 2.5 s ────────────
  useEffect(() => {
    if (etat !== "echec") return
    const timer = setTimeout(() => onBasculerPin(), 2500)
    return () => clearTimeout(timer)
  }, [etat, onBasculerPin])

  // ── Fonction d'analyse ──────────────────────────────────────────────────────
  async function analyser() {
    if (enCoursRef.current) return
    enCoursRef.current = true

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) { enCoursRef.current = false; return }

    setEtat("analyse")

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext("2d")!.drawImage(video, 0, 0)

    // Verification luminosite avant d'envoyer au serveur
    if (!luminositeSuffisante(canvas)) {
      setMessage("Luminosite insuffisante — placez-vous dans un endroit mieux eclaire.")
      stopperCamera()
      setEtat("echec")
      return
    }

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setMessage("Impossible de capturer l'image.")
        stopperCamera()
        setEtat("echec")
        return
      }

      try {
        const res = await identifierVisageLive(door.rawId, blob)

        if (res.autorise) {
          setMessage(res.message)
          setEtat("succes")
          stopperCamera()
          qc.invalidateQueries({ queryKey: ["portes", entrepriseId] })
          setTimeout(() => { onSucces(res.nom ?? ""); fermer() }, 2000)
          return
        }

        // Aucun visage detecte → 1 retry automatique
        const nouvelle = tentativeRef.current + 1
        tentativeRef.current = nouvelle

        if (res.raison === "aucun_visage" && nouvelle < MAX_TENTATIVES) {
          setMessage("Aucun visage detecte — nouvelle tentative...")
          setEtat("nouvelle_tentative")
          return
        }

        // Visage non reconnu ou max tentatives atteint → PIN
        setMessage(res.message)
        stopperCamera()
        setEtat("echec")

      } catch {
        setMessage("Erreur reseau — utilisez votre code PIN.")
        stopperCamera()
        setEtat("echec")
      }
    }, "image/jpeg", 0.92)
  }

  // Toujours garder le ref pointe vers la derniere version d'analyser
  analyserRef.current = analyser

  // ── Titre modal ─────────────────────────────────────────────────────────────
  const titre =
    etat === "succes" ? "Acces accorde" :
    etat === "echec"  ? "Acces refuse" :
    `Reconnaissance faciale — ${door.name}`

  return (
    <Modal ouvert onFermer={fermer} titre={titre}>
      <div className="space-y-4">

        {/* ── Flux video (etats actifs) ──────────────────────────────────── */}
        {(etat === "demarrage" || etat === "pret" || etat === "analyse" || etat === "nouvelle_tentative") && (
          <div
            className="relative overflow-hidden rounded-[3px] bg-black"
            style={{ aspectRatio: "4/3" }}
          >
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

            {/* Cadre de scan + decompte */}
            {etat === "pret" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 rounded-full border-2 border-primary/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                <ScanFace className="absolute h-10 w-10 text-primary/80 animate-pulse" />
                <span className="absolute bottom-8 text-white text-4xl font-bold tabular-nums drop-shadow-lg">
                  {decompte}
                </span>
              </div>
            )}

            {/* Analyse en cours */}
            {etat === "analyse" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
                <p className="text-white text-sm font-medium">Analyse en cours...</p>
              </div>
            )}

            {/* Nouvelle tentative */}
            {etat === "nouvelle_tentative" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3 px-6">
                <ScanFace className="h-10 w-10 text-yellow-400 animate-pulse" />
                <p className="text-white text-sm font-medium text-center">{message}</p>
              </div>
            )}

            {/* Demarrage */}
            {etat === "demarrage" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <Camera className="h-10 w-10 text-white/40 animate-pulse" />
              </div>
            )}
          </div>
        )}

        {/* ── Succes ────────────────────────────────────────────────────────── */}
        {etat === "succes" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <p className="text-center font-semibold text-green-700 dark:text-green-400">{message}</p>
            <p className="text-xs text-muted-foreground">La porte s'ouvre automatiquement...</p>
          </div>
        )}

        {/* ── Echec reconnu ─────────────────────────────────────────────────── */}
        {etat === "echec" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-center text-sm font-medium text-destructive">{message}</p>
            <p className="text-xs text-center text-muted-foreground">
              Basculement vers le code PIN...
            </p>
          </div>
        )}

        {/* ── Erreur camera ─────────────────────────────────────────────────── */}
        {etat === "erreur_camera" && (
          <div className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive text-center space-y-2">
            <Camera className="h-6 w-6 mx-auto opacity-60" />
            <p>Impossible d'acceder a la camera.</p>
            <p className="text-xs text-muted-foreground">Basculement vers le code PIN...</p>
          </div>
        )}

        {/* Canvas cache pour la capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Instruction pendant le decompte */}
        {etat === "pret" && (
          <p className="text-center text-xs text-muted-foreground">
            Centrez votre visage dans le cercle — capture automatique dans{" "}
            <span className="font-medium text-foreground">{decompte}s</span>.
          </p>
        )}

        {/* Boutons */}
        <div className="flex justify-between gap-2 pt-1">
          {etat !== "succes" && etat !== "echec" && etat !== "erreur_camera" && (
            <Button variant="outline" onClick={fermer}>
              Annuler
            </Button>
          )}

          {/* Capture manuelle immediate pendant le decompte */}
          {etat === "pret" && (
            <Button onClick={() => analyser()} className="flex-1">
              <ScanFace className="h-4 w-4" />
              Analyser maintenant
            </Button>
          )}

          {/* Bouton direct PIN sur echec (complementaire a l'auto-bascule) */}
          {(etat === "echec" || etat === "erreur_camera") && (
            <Button onClick={onBasculerPin} className="flex-1">
              <KeyRound className="h-4 w-4" />
              Utiliser le code PIN
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
