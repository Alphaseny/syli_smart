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
import { Pencil, UserX } from "lucide-react"

type BureauOption = { id: string; nomBureau: string }

type Props = {
  utilisateurs: Utilisateur[]
  bureaux: BureauOption[]
  loading: boolean
  onEdit: (user: Utilisateur) => void
  onDelete: (user: Utilisateur) => void
  supprimerEnCours?: boolean
}

export function TableauUtilisateurs({
  utilisateurs,
  bureaux,
  loading,
  onEdit,
  onDelete,
  supprimerEnCours = false,
}: Props) {
  const nomBureau = (bureauId: number | null) => {
    if (!bureauId) return <span className="text-muted-foreground">—</span>
    const bureau = bureaux.find((b) => b.id === String(bureauId))
    return bureau ? bureau.nomBureau : `Bureau ${bureauId}`
  }

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
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {utilisateurs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
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
                <TableCell>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      className="inline-flex items-center gap-2 rounded-[3px] border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground transition hover:bg-secondary/80"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {user.status === "actif" ? (
                      <button
                        type="button"
                        disabled={supprimerEnCours}
                        onClick={() => {
                          if (window.confirm(`Désactiver le compte de ${user.fullName} ?\nL'utilisateur ne pourra plus se connecter.`))
                            onDelete(user)
                        }}
                        title="Désactiver ce compte"
                        className="inline-flex items-center gap-2 rounded-[3px] border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="px-3 py-2 text-xs text-muted-foreground">Inactif</span>
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
