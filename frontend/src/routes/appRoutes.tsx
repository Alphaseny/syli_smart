import { useAuthContext } from "@/contexts/auth-context"
import { useRole } from "@/hooks/useRole"
import { AuthLayout } from "@/layouts/AuthLayout"
import { DashboardLayout } from "@/layouts/DashboardLayout"
import { AlertesPage } from "@/pages/Alertes"
import Bureau from "@/pages/Bureaux/Bureau"
import { CamerasPage } from "@/pages/Cameras"
import { ConnexionPage } from "@/pages/Connexion"
import { HistoriquePage } from "@/pages/Historique"
import { InscriptionPage } from "@/pages/Inscription"
import { LampesPage } from "@/pages/Lampes"
import { MotDePasseOubliePage } from "@/pages/MotDePasseOublie"
import { PortesPage } from "@/pages/Portes"
import { TableauDeBordPage } from "@/pages/TableauDeBord"
import { UtilisateursPage } from "@/pages/Utilisateurs"
import { Navigate, Route, Routes } from "react-router-dom"

function EcranChargement() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Chargement...</p>
    </div>
  )
}

/** Redirige vers /login si non connecté. */
function RoutePrivee({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext()
  if (isLoading) return <EcranChargement />
  return isAuthenticated ? <>{children}</> : <Navigate replace to="/login" />
}

/** Redirige vers /dashboard si déjà connecté. */
function RoutePublique({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext()
  if (isLoading) return <EcranChargement />
  return isAuthenticated ? <Navigate replace to="/dashboard" /> : <>{children}</>
}

/** Redirige vers /dashboard si l'utilisateur n'est pas administrateur. */
function RouteAdminSeulement({ children }: { children: React.ReactNode }) {
  const { estAdmin } = useRole()
  return estAdmin ? <>{children}</> : <Navigate replace to="/dashboard" />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/login" />} />

      {/* Routes publiques */}
      <Route element={<RoutePublique><AuthLayout /></RoutePublique>}>
        <Route path="/login" element={<ConnexionPage />} />
        <Route path="/signup" element={<InscriptionPage />} />
        <Route path="/forgot-password" element={<MotDePasseOubliePage />} />
      </Route>

      {/* Routes privées */}
      <Route element={<RoutePrivee><DashboardLayout /></RoutePrivee>}>
        <Route path="/dashboard" element={<TableauDeBordPage />} />
        <Route path="/cameras" element={<CamerasPage />} />
        <Route path="/doors" element={<PortesPage />} />
        <Route path="/lights" element={<LampesPage />} />
        <Route path="/alerts" element={<AlertesPage />} />
        <Route path="/history" element={<HistoriquePage />} />

        {/* Routes réservées aux administrateurs */}
        <Route path="/users" element={<RouteAdminSeulement><UtilisateursPage /></RouteAdminSeulement>} />
        <Route path="/bureau" element={<RouteAdminSeulement><Bureau /></RouteAdminSeulement>} />
      </Route>

      <Route path="*" element={<Navigate replace to="/login" />} />
    </Routes>
  )
}
