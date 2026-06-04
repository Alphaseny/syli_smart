import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRole } from "@/hooks/useRole"
import { type Camera } from "@/types/camera"
import { Camera as CameraIcon, Circle, CircleOff, Trash2, Wifi, WifiOff } from "lucide-react"
import { useCommanderCamera, useSupprimerCamera } from "../hooks/useCommanderCamera"

type Props = { camera: Camera }

export function CameraStatusCard({ camera }: Props) {
  const { estAdmin } = useRole()
  const commander = useCommanderCamera()
  const supprimer = useSupprimerCamera()

  return (
    <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Caméra
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

      {/* Flux vidéo */}
      {camera.streamUrl && camera.isOnline ? (
        <div className="mt-4 overflow-hidden rounded-[3px] bg-black">
          <img
            src={camera.snapshotUrl ?? camera.streamUrl}
            alt={`Aperçu ${camera.name}`}
            className="w-full object-cover"
            style={{ maxHeight: 160 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        </div>
      ) : (
        <div className="mt-4 flex h-24 items-center justify-center rounded-[3px] bg-muted">
          <CameraIcon className="h-8 w-8 text-muted-foreground opacity-40" />
        </div>
      )}

      {/* Actions */}
      {estAdmin && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => commander.mutate({ id: camera.rawId, action: "snapshot" })}
              disabled={!camera.isOnline || commander.isPending}
              title="Prendre un snapshot"
            >
              <CameraIcon className="h-4 w-4" /> Snapshot
            </Button>
            <Button
              size="sm"
              variant={camera.enregistrementActif ? "destructive" : "outline"}
              onClick={() =>
                commander.mutate({
                  id: camera.rawId,
                  action: camera.enregistrementActif ? "enregistrement_off" : "enregistrement_on",
                })
              }
              disabled={!camera.isOnline || commander.isPending}
            >
              {camera.enregistrementActif ? (
                <><CircleOff className="h-4 w-4" /> Arrêter</>
              ) : (
                <><Circle className="h-4 w-4" /> Enregistrer</>
              )}
            </Button>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => supprimer.mutate(camera.rawId)}
            disabled={supprimer.isPending}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}

      {/* Connexion */}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        {camera.isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {camera.isOnline ? "Connectée au réseau" : "Hors ligne"}
      </div>
    </div>
  )
}
