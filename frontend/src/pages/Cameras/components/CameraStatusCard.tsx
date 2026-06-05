import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRole } from "@/hooks/useRole"
import { type Camera } from "@/types/camera"
import {
  Camera as CameraIcon,
  Circle,
  CircleOff,
  Eye,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useCommanderCamera, useSupprimerCamera } from "../hooks/useCommanderCamera"
import { pingCamera } from "../services/camera.service"
import { CameraViewer } from "./CameraViewer"

type Props = { camera: Camera }

export function CameraStatusCard({ camera }: Props) {
  const { estAdmin } = useRole()
  const commander = useCommanderCamera()
  const supprimer = useSupprimerCamera()
  const qc = useQueryClient()
  const [viewerOuvert, setViewerOuvert] = useState(false)

  const ping = useMutation({
    mutationFn: () => pingCamera(camera.rawId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  })

  return (
    <>
      <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Caméra Jortan
            </p>
            <h3 className="mt-1 text-lg font-semibold">{camera.name}</h3>
            <p className="text-sm text-muted-foreground">{camera.location}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={camera.isOnline ? "success" : "destructive"}>
              {camera.isOnline ? "En ligne" : "Hors ligne"}
            </Badge>
            {camera.enregistrementActif && (
              <Badge variant="destructive" className="animate-pulse">
                ● Enregistrement
              </Badge>
            )}
          </div>
        </div>

        {/* Zone aperçu cliquable */}
        <button
          type="button"
          className={`mt-4 flex h-28 w-full cursor-pointer items-center justify-center rounded-[3px] transition-colors ${
            camera.isOnline
              ? "bg-muted hover:bg-muted/70 active:bg-muted/50"
              : "cursor-not-allowed bg-muted opacity-40"
          }`}
          onClick={() => camera.isOnline && setViewerOuvert(true)}
          disabled={!camera.isOnline}
          title={camera.isOnline ? "Cliquer pour voir en direct" : "Caméra hors ligne"}
        >
          {camera.isOnline ? (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <Eye className="h-7 w-7" />
              <span className="text-xs">Cliquer pour voir en direct</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <WifiOff className="h-7 w-7 opacity-50" />
              <span className="text-xs">Hors ligne</span>
            </div>
          )}
        </button>

        {/* Bouton Live principal */}
        <Button
          className="mt-3 w-full gap-2"
          size="sm"
          variant={camera.isOnline ? "default" : "outline"}
          disabled={!camera.isOnline}
          onClick={() => setViewerOuvert(true)}
        >
          <Eye className="h-4 w-4" />
          {camera.isOnline ? "Voir en direct" : "Hors ligne"}
        </Button>

        {/* Actions admin */}
        {estAdmin && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => commander.mutate({ id: camera.rawId, action: "snapshot" })}
                disabled={!camera.isOnline || commander.isPending}
                title="Snapshot MQTT"
              >
                <CameraIcon className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={camera.enregistrementActif ? "destructive" : "outline"}
                onClick={() =>
                  commander.mutate({
                    id: camera.rawId,
                    action: camera.enregistrementActif
                      ? "enregistrement_off"
                      : "enregistrement_on",
                  })
                }
                disabled={!camera.isOnline || commander.isPending}
              >
                {camera.enregistrementActif ? (
                  <>
                    <CircleOff className="h-4 w-4" /> Arrêter
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4" /> REC
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => ping.mutate()}
                disabled={ping.isPending}
                title="Vérifier la connectivité réseau"
              >
                <RefreshCw
                  className={`h-4 w-4 ${ping.isPending ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => supprimer.mutate(camera.rawId)}
              disabled={supprimer.isPending}
              title="Supprimer la caméra"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}

        {/* Statut réseau */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {camera.isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-green-500" />
              Connectée au réseau local
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              Hors ligne — cliquez sur ↺ pour vérifier
            </>
          )}
        </div>
      </div>

      {viewerOuvert && (
        <CameraViewer camera={camera} onFermer={() => setViewerOuvert(false)} />
      )}
    </>
  )
}
