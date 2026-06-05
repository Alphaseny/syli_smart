import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type Utilisateur } from "@/types/user"
import { Camera, CreditCard, Pencil, UserX } from "lucide-react"
import { type UtilisateurEnrole } from "../services/reconnaissance.service"

type BureauOption = { id: string; nomBureau: string }

type Props = {
  utilisateurs: Utilisateur[]
  bureaux: BureauOption[]
  loading: boolean
  onEdit: (user: Utilisateur) => void
  onDelete: (user: Utilisateur) => void
  onGererVisage: (user: Utilisateur) => void
  onGererRfid: (user: Utilisateur) => void
  supprimerEnCours?: boolean
  utilisateursEnroles: UtilisateurEnrole[]
}

export function TableauUtilisateurs({
  utilisateurs,
  bureaux,
  loading,
  onEdit,
  onDelete,
  onGererVisage,
  onGererRfid,
  supprimerEnCours = false,
  utilisateursEnroles,
}: Props) {
  const nomBureau = (bureauId: number | null) => {
    if (!bureauId) return <span className="text-muted-foreground">—</span>
    const bureau = bureaux.find((b) => b.id === String(bureauId))
    return bureau ? bureau.nomBureau : `Bureau ${bureauId}`
  }

  const estEnrole = (userId: string) =>
    utilisateursEnroles.some((e) => String(e.utilisateur_id) === userId)

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Chargement des utilisateurs...
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-[3px] border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Bureau</TableHead>
            <TableHead>Statut</TableHead>
            {/* <TableHead>Visage</TableHead> */}
            <TableHead>RFID</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {utilisateurs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-muted-foreground"
              >
                Aucun utilisateur trouvé.
              </TableCell>
            </TableRow>
          ) : (
            utilisateurs.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.fullName}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell className="capitalize">{user.role}</TableCell>
                <TableCell>{nomBureau(user.bureau_id)}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      user.status === "actif"
                        ? "bg-primary/15 text-primary"
                        : "bg-destructive/15 text-destructive"
                    }
                  >
                    {user.status}
                  </Badge>
                </TableCell>

                {/* Colonne reconnaissance faciale */}
                {/* <TableCell>
                  {estEnrole(user.id) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle className="h-3.5 w-3.5" /> Enregistré
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell> */}

                {/* Colonne RFID (bouton gérer) */}
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onGererRfid(user)}
                    title="Gérer les cartes RFID"
                    className="inline-flex items-center gap-1.5 rounded-[3px] border border-border bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground transition hover:bg-secondary/80"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    RFID
                  </button>
                </TableCell>

                <TableCell>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      title="Modifier l'utilisateur"
                      className="inline-flex items-center gap-2 rounded-[3px] border border-border  px-2 py-1 text-sm bg-amber-500 text-white  transition hover:bg-secondary/80"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {/* Bouton enregistrement visage */}
                    <button
                      type="button"
                      onClick={() => onGererVisage(user)}
                      title={
                        estEnrole(user.id)
                          ? "Gérer le visage enregistré"
                          : "Enregistrer le visage"
                      }
                      className={`inline-flex items-center gap-2 rounded-[3px] border px-3 py-2 text-sm transition ${
                        estEnrole(user.id)
                          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      <Camera className="h-4 w-4" />
                    </button>

                    {user.status === "actif" ? (
                      <button
                        type="button"
                        disabled={supprimerEnCours}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Désactiver le compte de ${user.fullName} ?\nL'utilisateur ne pourra plus se connecter.`
                            )
                          )
                            onDelete(user)
                        }}
                        title="Désactiver ce compte"
                        className="inline-flex items-center gap-2 rounded-[3px] border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="px-3 py-2 text-xs text-muted-foreground">
                        Inactif
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
