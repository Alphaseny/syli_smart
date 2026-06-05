import { Button } from "@/components/ui/button"
import { useRole } from "@/hooks/useRole"
import { type Utilisateur } from "@/types/user"
import { UserPlus, X } from "lucide-react"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { recupererBureaux } from "@/pages/Bureaux/services/bureau.service"
import { FormulaireUtilisateur } from "./components/FormulaireUtilisateur"
import { ModalEnregistrementVisage } from "./components/ModalEnregistrementVisage"
import { ModalRfid } from "./components/ModalRfid"
import { TableauUtilisateurs } from "./components/TableauUtilisateurs"
import { useAjouterUtilisateur } from "./hooks/useAjouterUtilisateur"
import { useModifierUtilisateur } from "./hooks/useModifierUtilisateur"
import { useSupprimerUtilisateur } from "./hooks/useSupprimerUtilisateur"
import { useUtilisateurs } from "./hooks/useUtilisateurs"
import { listerVisagesEnroles } from "./services/reconnaissance.service"
import { type ValeursFormulaireUtilisateur } from "./services/utilisateur.service"

export function UtilisateursPage() {
  const { entrepriseId } = useRole()
  const qc = useQueryClient()

  const { data: utilisateurs = [], isLoading, error } = useUtilisateurs()
  const { data: bureaux = [] } = useQuery({
    queryKey: ["bureaux", entrepriseId],
    queryFn: recupererBureaux,
    staleTime: 0,
    enabled: entrepriseId !== null,
  })
  const { data: utilisateursEnroles = [] } = useQuery({
    queryKey: ["visages-enroles", entrepriseId],
    queryFn: listerVisagesEnroles,
    staleTime: 1000 * 60 * 3,
    enabled: entrepriseId !== null,
  })

  const mutationAjouter = useAjouterUtilisateur()
  const mutationModifier = useModifierUtilisateur()
  const mutationSupprimer = useSupprimerUtilisateur()

  const [utilisateurSelectionne, setUtilisateurSelectionne] = useState<Utilisateur | null>(null)
  const [formulaireVisible, setFormulaireVisible] = useState(false)
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null)
  const [utilisateurVisage, setUtilisateurVisage] = useState<Utilisateur | null>(null)
  const [utilisateurRfid, setUtilisateurRfid] = useState<Utilisateur | null>(null)

  const ouvrirAjout = () => {
    setUtilisateurSelectionne(null)
    setErreurFormulaire(null)
    setFormulaireVisible(true)
  }

  const ouvrirModification = (utilisateur: Utilisateur) => {
    setUtilisateurSelectionne(utilisateur)
    setErreurFormulaire(null)
    setFormulaireVisible(true)
  }

  const fermerFormulaire = () => {
    setFormulaireVisible(false)
    setUtilisateurSelectionne(null)
    setErreurFormulaire(null)
  }

  const gererSoumission = async (valeurs: ValeursFormulaireUtilisateur) => {
    try {
      setErreurFormulaire(null)
      if (utilisateurSelectionne) {
        await mutationModifier.mutateAsync({ id: utilisateurSelectionne.id, valeurs })
      } else {
        await mutationAjouter.mutateAsync(valeurs)
      }
      fermerFormulaire()
    } catch (err) {
      setErreurFormulaire(err instanceof Error ? err.message : "Une erreur est survenue.")
    }
  }

  const estEnChargement = mutationAjouter.isPending || mutationModifier.isPending

  const estEnrole = (userId: string) =>
    utilisateursEnroles.some((e) => String(e.utilisateur_id) === userId)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Gestion</p>
          <h2 className="text-2xl font-semibold">Utilisateurs</h2>
        </div>
        {!formulaireVisible ? (
          <Button onClick={ouvrirAjout} className="gap-2">
            <UserPlus size={16} />
            Ajouter un utilisateur
          </Button>
        ) : (
          <Button variant="outline" onClick={fermerFormulaire} className="gap-2">
            <X size={16} />
            Fermer le formulaire
          </Button>
        )}
      </div>

      {/* Formulaire */}
      {formulaireVisible && (
        <div className="rounded-[3px] border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">
            {utilisateurSelectionne ? `Modifier — ${utilisateurSelectionne.fullName}` : "Nouvel utilisateur"}
          </h3>
          {erreurFormulaire && (
            <div className="mb-4 rounded-[3px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {erreurFormulaire}
            </div>
          )}
          <FormulaireUtilisateur
            utilisateur={utilisateurSelectionne}
            bureaux={bureaux.filter((b) => b.etat).map((b) => ({ id: b.id, nomBureau: b.nomBureau }))}
            loading={estEnChargement}
            onSubmit={gererSoumission}
            onCancel={fermerFormulaire}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {/* Tableau */}
      <TableauUtilisateurs
        utilisateurs={utilisateurs}
        bureaux={bureaux.map((b) => ({ id: b.id, nomBureau: b.nomBureau }))}
        loading={isLoading}
        onEdit={ouvrirModification}
        onDelete={(user) => mutationSupprimer.mutate(user.id)}
        onGererVisage={setUtilisateurVisage}
        onGererRfid={setUtilisateurRfid}
        supprimerEnCours={mutationSupprimer.isPending}
        utilisateursEnroles={utilisateursEnroles}
      />

      {/* Modal reconnaissance faciale */}
      {utilisateurVisage && (
        <ModalEnregistrementVisage
          utilisateur={utilisateurVisage}
          estEnrole={estEnrole(utilisateurVisage.id)}
          onFermer={() => setUtilisateurVisage(null)}
          onSucces={() => qc.invalidateQueries({ queryKey: ["visages-enroles"] })}
        />
      )}

      {/* Modal RFID */}
      {utilisateurRfid && (
        <ModalRfid
          utilisateur={utilisateurRfid}
          onFermer={() => setUtilisateurRfid(null)}
        />
      )}
    </div>
  )
}
