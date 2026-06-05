import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRole } from "@/hooks/useRole"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, Pencil, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import {
  ajouterBureau,
  modifierBureau,
  recupererBureaux,
  supprimerBureau,
  type Bureau,
  type ValeursFormulaireBureau,
} from "./services/bureau.service"

type ModeFormulaire = "ajout" | "edition" | null

export default function BureauPage() {
  const clientRequetes = useQueryClient()
  const { entrepriseId } = useRole()
  const [mode, setMode] = useState<ModeFormulaire>(null)
  const [bureauEnEdition, setBureauEnEdition] = useState<Bureau | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const { data: bureaux = [], isLoading } = useQuery<Bureau[], Error>({
    queryKey: ["bureaux", entrepriseId],
    queryFn: recupererBureaux,
    staleTime: 0,
    enabled: entrepriseId !== null,
  })

  const mutationAjouter = useMutation<Bureau, Error, ValeursFormulaireBureau>({
    mutationFn: ajouterBureau,
    onSuccess: () => {
      clientRequetes.invalidateQueries({ queryKey: ["bureaux"] })
      fermerFormulaire()
    },
    onError: (err) => setErreur(err.message),
  })

  const mutationModifier = useMutation<
    Bureau,
    Error,
    { id: string; valeurs: ValeursFormulaireBureau }
  >({
    mutationFn: modifierBureau,
    onSuccess: () => {
      clientRequetes.invalidateQueries({ queryKey: ["bureaux"] })
      fermerFormulaire()
    },
    onError: (err) => setErreur(err.message),
  })

  const mutationSupprimer = useMutation<void, Error, string>({
    mutationFn: supprimerBureau,
    onSuccess: () => clientRequetes.invalidateQueries({ queryKey: ["bureaux"] }),
    onError: (err) => setErreur(err.message),
  })

  const ouvrirAjout = () => {
    setBureauEnEdition(null)
    setErreur(null)
    setMode("ajout")
  }

  const ouvrirEdition = (bureau: Bureau) => {
    setBureauEnEdition(bureau)
    setErreur(null)
    setMode("edition")
  }

  const fermerFormulaire = () => {
    setMode(null)
    setBureauEnEdition(null)
    setErreur(null)
  }

  const gererSoumission = (e: { currentTarget: HTMLFormElement; preventDefault(): void }) => {
    e.preventDefault()
    const donnees = new FormData(e.currentTarget)
    setErreur(null)
    const valeurs: ValeursFormulaireBureau = {
      nomBureau: String(donnees.get("nomBureau") ?? "").trim(),
      etage: String(donnees.get("etage") ?? "").trim() || undefined,
      etat: mode === "edition" ? donnees.get("etat") === "actif" : true,
    }
    if (mode === "edition" && bureauEnEdition) {
      mutationModifier.mutate({ id: bureauEnEdition.id, valeurs })
    } else {
      mutationAjouter.mutate(valeurs)
    }
  }

  const estEnChargement = mutationAjouter.isPending || mutationModifier.isPending

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">Espaces de travail</p>
          <h2 className="text-xl font-semibold">Bureaux</h2>
          <p className="text-sm text-muted-foreground">
            Gérez les bureaux de votre entreprise.
          </p>
        </div>
        {mode === null ? (
          <Button onClick={ouvrirAjout} className="gap-2">
            <Plus size={16} />
            Nouveau bureau
          </Button>
        ) : (
          <Button variant="outline" onClick={fermerFormulaire} className="gap-2">
            <X size={16} />
            Annuler
          </Button>
        )}
      </div>

      {/* Formulaire ajout / édition */}
      {mode !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {mode === "edition" ? `Modifier — ${bureauEnEdition?.nomBureau}` : "Ajouter un bureau"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {erreur && (
              <div className="mb-4 rounded-[3px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {erreur}
              </div>
            )}
            <form className="space-y-4" onSubmit={gererSoumission}>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="nomBureau">Nom du bureau</Label>
                  <div className="flex items-center gap-2 rounded-[3px] border border-border px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                    <Building2 size={16} strokeWidth={2.5} color="oklch(0.56 0.2 250)" />
                    <Input
                      id="nomBureau"
                      name="nomBureau"
                      placeholder="Bureau 101"
                      defaultValue={bureauEnEdition?.nomBureau ?? ""}
                      required
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <Label htmlFor="etage">Étage (optionnel)</Label>
                  <Input
                    id="etage"
                    name="etage"
                    placeholder="1er étage"
                    defaultValue={bureauEnEdition?.etage ?? ""}
                  />
                </div>
              </div>

              {mode === "edition" && (
                <div className="flex-1">
                  <Label htmlFor="etat">Statut</Label>
                  <div className="rounded-[3px] border border-border pl-2">
                    <select
                      id="etat"
                      name="etat"
                      className="w-full bg-background py-1.5 pr-2 text-sm"
                      defaultValue={bureauEnEdition?.etat ? "actif" : "inactif"}
                    >
                      <option value="actif">Actif</option>
                      <option value="inactif">Inactif</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={estEnChargement}>
                  {estEnChargement
                    ? mode === "edition" ? "Modification..." : "Enregistrement..."
                    : mode === "edition" ? "Modifier" : "Enregistrer"}
                </Button>
                <Button type="button" variant="outline" onClick={fermerFormulaire}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Message d'erreur global */}
      {erreur && mode === null && (
        <div className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {erreur}
        </div>
      )}

      {/* Tableau */}
      <Card className="p-0">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Chargement...</p>
          ) : bureaux.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Aucun bureau enregistré.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Étage</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bureaux.map((bureau) => (
                  <TableRow key={bureau.id}>
                    <TableCell className="font-medium">{bureau.nomBureau}</TableCell>
                    <TableCell>{bureau.etage ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={bureau.etat ? "success" : "outline"}>
                        {bureau.etat ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell>{bureau.dateCreation}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => ouvrirEdition(bureau)}
                          className="inline-flex items-center gap-2 rounded-[3px] border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground transition hover:bg-secondary/80"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => mutationSupprimer.mutate(bureau.id)}
                          disabled={mutationSupprimer.isPending}
                          className="inline-flex items-center gap-2 rounded-[3px] border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive transition hover:bg-destructive/20"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
