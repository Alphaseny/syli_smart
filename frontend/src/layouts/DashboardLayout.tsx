import { useAuthContext } from "@/contexts/auth-context"
import { useRole } from "@/hooks/useRole"
import { cn } from "@/lib/utils"
import {
  Bell,
  Clock3,
  DoorClosedLocked,
  DoorOpen,
  Home,
  Lightbulb,
  LogOut,
  Users,
  Video,
} from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"

type NavItem = { to: string; label: string; icon: React.ElementType; adminSeulement?: boolean }

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: Home },
  { to: "/users",     label: "Utilisateurs",    icon: Users,          adminSeulement: true },
  { to: "/cameras",   label: "Caméras",          icon: Video },
  { to: "/doors",     label: "Portes",            icon: DoorOpen },
  { to: "/lights",    label: "Lampes",            icon: Lightbulb },
  { to: "/bureau",    label: "Bureaux",           icon: DoorClosedLocked, adminSeulement: true },
  { to: "/alerts",    label: "Alertes",           icon: Bell },
  { to: "/history",   label: "Historique",        icon: Clock3 },
]

export function DashboardLayout() {
  const { user, signOut } = useAuthContext()
  const { estAdmin } = useRole()

  const itemsVisibles = navItems.filter((item) => !item.adminSeulement || estAdmin)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r border-border bg-sidebar px-4 py-6 text-sidebar-foreground">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              SB
            </div>

            <div>
              <p className="text-sm font-semibold">Smart Bureau</p>
              <p className="text-xs text-muted-foreground">
                Gestion centralisée
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {itemsVisibles.map((item) => {
              const Icone = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-[3px] px-4 py-3 text-sm font-medium transition",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )
                  }
                >
                  <Icone className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-10 rounded-[3px] border border-border bg-card p-4 text-sm">
            <p className="font-medium">Connecté en tant que</p>

            <p className="mt-1 truncate text-muted-foreground">
              {user?.fullName ?? "Utilisateur"}
            </p>

            <button
              type="button"
              onClick={signOut}
              className="mt-4 inline-flex items-center gap-2 rounded-[3px] bg-destructive px-4 py-2 text-sm font-semibold text-white transition hover:bg-destructive/90"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </aside>

        <main className="px-6 py-6 lg:px-10">
          <div className="mb-6 flex flex-col gap-4 rounded-[3px] border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase">
                Tableau de bord
              </p>

              <h1 className="text-xl font-semibold">Espace de supervision</h1>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  )
}
