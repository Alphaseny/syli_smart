import { Bell, BellRing, Check, CheckCheck, Shield, TriangleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useMarquerLue, useMarquerToutesLues, useNotifications } from "@/hooks/useNotifications"
import { type Notification } from "@/services/notifications.service"
import { cn } from "@/lib/utils"

const ICONE_TYPE: Record<Notification["type"], React.ElementType> = {
  alerte: TriangleAlert,
  securite: Shield,
  rappel: Bell,
}

const COULEUR_TYPE: Record<Notification["type"], string> = {
  alerte: "text-amber-500",
  securite: "text-destructive",
  rappel: "text-primary",
}

function ItemNotification({
  notif,
  onLire,
}: {
  notif: Notification
  onLire: (id: number) => void
}) {
  const Icone = ICONE_TYPE[notif.type]
  const couleur = COULEUR_TYPE[notif.type]
  const date = new Date(notif.date_creation).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
        !notif.lue && "bg-primary/5"
      )}
    >
      <div className={cn("mt-0.5 shrink-0", couleur)}>
        <Icone className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", !notif.lue && "font-semibold")}>{notif.titre}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">{date}</p>
      </div>
      {!notif.lue && (
        <button
          type="button"
          onClick={() => onLire(notif.id)}
          className="shrink-0 rounded-full p-1 hover:bg-muted transition-colors"
          title="Marquer comme lue"
        >
          <Check className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

export function NotificationsBell() {
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: notifs = [] } = useNotifications()
  const marquerLue = useMarquerLue()
  const marquerToutes = useMarquerToutesLues()

  const nonLues = notifs.filter((n) => !n.lue).length

  // Fermer au clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOuvert(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-[3px] border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Notifications"
      >
        {nonLues > 0 ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {nonLues > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-[3px] border border-border bg-card shadow-lg">
          {/* En-tête */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">
              Notifications{" "}
              {nonLues > 0 && (
                <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-white">
                  {nonLues}
                </span>
              )}
            </p>
            {nonLues > 0 && (
              <button
                type="button"
                onClick={() => marquerToutes.mutate()}
                disabled={marquerToutes.isPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Tout marquer
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifs.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aucune notification.
              </p>
            ) : (
              notifs
                .slice(0, 20)
                .map((n) => (
                  <ItemNotification
                    key={n.id}
                    notif={n}
                    onLire={(id) => marquerLue.mutate(id)}
                  />
                ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
