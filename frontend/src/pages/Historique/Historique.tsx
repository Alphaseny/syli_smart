import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useState } from "react"
import { ActivityTimeline } from "./components/ActivityTimeline"
import { useActivites } from "./hooks/useActivites"
import { exporterHistoriqueCSV } from "./services/activity.service"

export function HistoriquePage() {
  const { data, isLoading, error } = useActivites()
  const [exportEnCours, setExportEnCours] = useState(false)
  const [erreurExport, setErreurExport] = useState("")

  async function handleExport() {
    setExportEnCours(true)
    setErreurExport("")
    try {
      await exporterHistoriqueCSV()
    } catch (e) {
      setErreurExport(e instanceof Error ? e.message : "Erreur d’export.")
    } finally {
      setExportEnCours(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Historique</p>
          <h2 className="text-2xl font-semibold">Journal d’activité</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Suivez les connexions, les ouvertures et les actions clés de votre système.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExport}
            disabled={exportEnCours}
          >
            <Download className="h-4 w-4" />
            {exportEnCours ? "Export..." : "Exporter CSV"}
          </Button>
          {erreurExport && (
            <p className="text-xs text-destructive">{erreurExport}</p>
          )}
        </div>
      </div>

      <ActivityTimeline
        activities={data ?? []}
        loading={isLoading}
        error={error?.message}
      />
    </div>
  )
}
