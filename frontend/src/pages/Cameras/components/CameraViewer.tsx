import { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { API_BASE_URL } from "@/constants/api"
import { type Camera } from "@/types/camera"
import { Loader2, Maximize2, Minimize2, RefreshCw, WifiOff, X } from "lucide-react"

type Props = { camera: Camera; onFermer: () => void }
type Mode = "tentative" | "live" | "polling" | "hors_ligne"

function lireToken(): string {
  try {
    const raw = localStorage.getItem("smart_bureau_auth")
    return (JSON.parse(raw ?? "{}") as { token?: string }).token ?? ""
  } catch {
    return ""
  }
}

export function CameraViewer({ camera, onFermer }: Props) {
  const token = lireToken()
  const [mode, setMode] = useState<Mode>("tentative")
  const [cle, setCle] = useState(0)
  const imgMjpegRef = useRef<HTMLImageElement>(null)
  const imgPollRef = useRef<HTMLImageElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval>>()
  const prevBlobRef = useRef("")
  const pollingActifRef = useRef(false)
  const [pleinEcran, setPleinEcran] = useState(false)

  const streamUrl = `${API_BASE_URL}/cameras/${camera.rawId}/stream?token=${encodeURIComponent(token)}&v=${cle}`
  const snapshotUrl = `${API_BASE_URL}/cameras/${camera.rawId}/snapshot`

  const arreterPolling = useCallback(() => {
    pollingActifRef.current = false
    clearInterval(pollTimerRef.current)
    if (prevBlobRef.current) {
      URL.revokeObjectURL(prevBlobRef.current)
      prevBlobRef.current = ""
    }
  }, [])

  const demarrerPolling = useCallback(() => {
    if (pollingActifRef.current) return
    pollingActifRef.current = true
    setMode("polling")

    async function charger() {
      if (!pollingActifRef.current) return
      try {
        const res = await fetch(snapshotUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) {
          if (pollingActifRef.current) setMode("hors_ligne")
          arreterPolling()
          return
        }
        const blob = await res.blob()
        if (!pollingActifRef.current) return
        const url = URL.createObjectURL(blob)
        if (imgPollRef.current) imgPollRef.current.src = url
        if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current)
        prevBlobRef.current = url
      } catch {
        if (pollingActifRef.current) {
          setMode("hors_ligne")
          arreterPolling()
        }
      }
    }

    charger()
    pollTimerRef.current = setInterval(charger, 2000)
  }, [snapshotUrl, token, arreterPolling])

  const relancer = useCallback(() => {
    arreterPolling()
    setMode("tentative")
    setCle((k) => k + 1)
  }, [arreterPolling])

  useEffect(() => {
    return arreterPolling
  }, [arreterPolling])

  // Fermer avec Échap
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onFermer])

  const badgeLabel: Record<Mode, string> = {
    tentative: "Connexion...",
    live: "● En direct",
    polling: "Image / 2 s",
    hors_ligne: "Hors ligne",
  }
  const badgeVariant: Record<Mode, "secondary" | "success" | "destructive"> = {
    tentative: "secondary",
    live: "success",
    polling: "secondary",
    hors_ligne: "destructive",
  }
  const infoMode: Record<Mode, string> = {
    tentative: "Connexion au flux vidéo Jortan en cours...",
    live: "Flux MJPEG en temps réel.",
    polling: "Mode de repli — snapshot toutes les 2 secondes (flux MJPEG indisponible).",
    hors_ligne: "Caméra hors ligne. Vérifiez qu'elle est sous tension et connectée au réseau.",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer() }}
    >
      <div
        className={`flex flex-col rounded-[3px] border border-border bg-card shadow-2xl transition-all ${
          pleinEcran ? "h-full w-full" : "w-full max-w-3xl"
        }`}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{camera.name}</span>
            <Badge variant={badgeVariant[mode]}>{badgeLabel[mode]}</Badge>
            <span className="text-xs text-muted-foreground">{camera.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={relancer}
              title="Relancer le flux"
              disabled={mode === "tentative"}
            >
              <RefreshCw className={`h-4 w-4 ${mode === "tentative" ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setPleinEcran((v) => !v)}
              title={pleinEcran ? "Fenêtré" : "Plein écran"}
            >
              {pleinEcran ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onFermer} title="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Zone vidéo */}
        <div
          className={`relative overflow-hidden bg-black ${pleinEcran ? "flex-1" : ""}`}
          style={pleinEcran ? undefined : { aspectRatio: "16/9" }}
        >
          {/* Flux MJPEG via proxy authentifié */}
          <img
            ref={imgMjpegRef}
            key={cle}
            src={streamUrl}
            alt={`Flux ${camera.name}`}
            className={`h-full w-full object-contain ${
              mode === "polling" || mode === "hors_ligne" ? "hidden" : ""
            }`}
            onLoad={() => setMode("live")}
            onError={() => {
              if (mode !== "polling" && mode !== "hors_ligne") {
                demarrerPolling()
              }
            }}
          />

          {/* Snapshot polling (repli) */}
          <img
            ref={imgPollRef}
            alt={`Snapshot ${camera.name}`}
            className={`h-full w-full object-contain ${mode === "polling" ? "" : "hidden"}`}
          />

          {/* Chargement initial */}
          {mode === "tentative" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-white/50" />
            </div>
          )}

          {/* Hors ligne */}
          {mode === "hors_ligne" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
              <WifiOff className="h-12 w-12 opacity-40" />
              <p className="text-sm opacity-70">Caméra hors ligne ou inaccessible</p>
              <Button size="sm" variant="outline" onClick={relancer}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Réessayer
              </Button>
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">{infoMode[mode]}</p>
        </div>
      </div>
    </div>
  )
}
