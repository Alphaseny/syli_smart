import { Button } from "@/components/ui/button"
import { useRole } from "@/hooks/useRole"
import { type Lamp } from "@/types/lamp"
import { Lightbulb, LightbulbOff, Power, Trash2 } from "lucide-react"
import { useCommanderLampe } from "../hooks/useCommanderLampe"
import { useSupprimerLampe } from "../hooks/useSupprimerLampe"

type Props = { lampe: Lamp }

export function LampeControl({ lampe }: Props) {
  const { estAdmin } = useRole()
  const commander = useCommanderLampe()
  const supprimer = useSupprimerLampe()

  const estAllumee = lampe.state === "allumee"
  const action: "allumer" | "eteindre" = estAllumee ? "eteindre" : "allumer"

  return (
    <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Lampe
          </p>
          <h3 className="mt-1 text-lg font-semibold">{lampe.name}</h3>
          <p className="text-sm text-muted-foreground">{lampe.location}</p>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-sm font-medium ${
            estAllumee
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {estAllumee ? (
            <Lightbulb className="h-3.5 w-3.5" />
          ) : (
            <LightbulbOff className="h-3.5 w-3.5" />
          )}
          {estAllumee ? "Allumée" : "Éteinte"}
        </div>
      </div>

      {/* Intensité + actions */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Intensité : {lampe.intensite}%
        </p>
        <div className="flex items-center gap-2">
          {estAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => supprimer.mutate(lampe.rawId)}
              disabled={supprimer.isPending}
              title="Supprimer cette lampe"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          <Button
            variant={estAllumee ? "outline" : "default"}
            size="sm"
            onClick={() =>
              commander.mutate({ id: lampe.rawId, action, intensitePct: lampe.intensite })
            }
            disabled={commander.isPending}
          >
            <Power className="h-4 w-4" />
            {commander.isPending
              ? "Envoi..."
              : estAllumee
                ? "Éteindre"
                : "Allumer"}
          </Button>
        </div>
      </div>
    </div>
  )
}
