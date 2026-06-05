import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import {
  AlarmClock,
  Bell,
  BotMessageSquare,
  Check,
  Heart,
  Lightbulb,
  Plus,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import {
  useCreerRappel,
  useMarquerExecute,
  useRappels,
  useSuggestionsHabitudes,
  useSupprimerRappel,
} from "./hooks/useRappels"
import type { NouveauRappel } from "./services/bienetre.service"

// ── Formulaire nouveau rappel ─────────────────────────────────────────────────

function FormulaireRappel({
  onFermer,
  onSoumettre,
  enCours,
}: {
  onFermer: () => void
  onSoumettre: (v: NouveauRappel) => void
  enCours: boolean
}) {
  const [titre, setTitre] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [erreur, setErreur] = useState("")

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreur("")
    if (!titre.trim()) return setErreur("Le titre est requis.")
    if (!date) return setErreur("La date est requise.")
    onSoumettre({ titre: titre.trim(), description: description.trim() || undefined, date_rappel: date })
  }

  return (
    <Modal ouvert onFermer={onFermer} titre="Nouveau rappel">
      <form onSubmit={soumettre} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="titre-rappel">Titre</Label>
          <Input
            id="titre-rappel"
            placeholder="Prise de médicaments, réunion..."
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc-rappel">Description <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
          <Input
            id="desc-rappel"
            placeholder="Détails supplémentaires..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date-rappel">Date et heure</Label>
          <Input
            id="date-rappel"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {erreur && <p className="text-sm text-destructive">{erreur}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onFermer}>Annuler</Button>
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement..." : "Créer le rappel"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export function BienEtrePage() {
  const { data: rappels = [], isLoading, error } = useRappels()
  const { data: suggestions = [] } = useSuggestionsHabitudes()
  const creer = useCreerRappel()
  const marquer = useMarquerExecute()
  const supprimer = useSupprimerRappel()

  const [modalOuvert, setModalOuvert] = useState(false)

  const rappelsActifs = rappels.filter((r) => !r.execute)
  const rappelsExecutes = rappels.filter((r) => r.execute)

  function fmtDate(d: string) {
    return new Date(d).toLocaleString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Assistance</p>
          <h2 className="text-2xl font-semibold">Bien-être & Rappels</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Rappels personnalisés, détection d'inactivité et suggestions d'automatisation.
          </p>
        </div>
        <Button onClick={() => setModalOuvert(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau rappel
        </Button>
      </div>

      {/* KPI rapide */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Rappels actifs",
            val: rappelsActifs.length,
            icone: Bell,
            couleur: "bg-primary/10 text-primary",
          },
          {
            label: "Exécutés",
            val: rappelsExecutes.length,
            icone: Check,
            couleur: "bg-green-500/10 text-green-600",
          },
          {
            label: "Suggestions IA",
            val: suggestions.length,
            icone: Lightbulb,
            couleur: "bg-amber-500/10 text-amber-500",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-[3px] border border-border bg-card p-5 shadow-sm flex items-center gap-4"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${k.couleur}`}>
              <k.icone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-bold">{k.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Liste rappels actifs */}
      <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <AlarmClock className="h-4 w-4 text-primary" />
          Rappels à venir
        </h3>

        {isLoading && <p className="mt-4 text-sm text-muted-foreground">Chargement...</p>}
        {error && <p className="mt-4 text-sm text-destructive">{error.message}</p>}

        {!isLoading && rappelsActifs.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucun rappel actif. Créez-en un avec le bouton ci-dessus.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {rappelsActifs.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 rounded-[3px] border border-border p-4 transition-colors hover:bg-muted/30"
            >
              <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{r.titre}</p>
                {r.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{fmtDate(r.date_rappel)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Marquer comme exécuté"
                  disabled={marquer.isPending}
                  onClick={() => marquer.mutate(r.id)}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Supprimer"
                  disabled={supprimer.isPending}
                  onClick={() => supprimer.mutate(r.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions IA habitudes */}
      {suggestions.length > 0 && (
        <div className="rounded-[3px] border border-border bg-card p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <BotMessageSquare className="h-4 w-4 text-amber-500" />
            Suggestions d'automatisation
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Basées sur l'analyse de vos 7 derniers jours d'activité.
          </p>
          <div className="mt-4 space-y-3">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-[3px] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {s.suggestion}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Heure habituelle : {s.heure_habituelle} — {s.frequence_jours}j/7
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rappels exécutés (repliés) */}
      {rappelsExecutes.length > 0 && (
        <details className="rounded-[3px] border border-border bg-card shadow-sm">
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Rappels exécutés ({rappelsExecutes.length})
          </summary>
          <div className="divide-y divide-border px-6 pb-4">
            {rappelsExecutes.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3 opacity-60">
                <Check className="h-4 w-4 shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm line-through">{r.titre}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(r.date_rappel)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={supprimer.isPending}
                  onClick={() => supprimer.mutate(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}

      {modalOuvert && (
        <FormulaireRappel
          onFermer={() => setModalOuvert(false)}
          enCours={creer.isPending}
          onSoumettre={(v) =>
            creer.mutate(v, { onSuccess: () => setModalOuvert(false) })
          }
        />
      )}
    </div>
  )
}
