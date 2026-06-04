import { type Activite } from "@/types/activity"
import { type LucideIcon, Bell, Clock3, DoorOpen, User } from "lucide-react"

type Props = { activities: Activite[]; loading: boolean; error?: string }
const activityIcons: Record<string, LucideIcon> = {
  connexion: User,
  ouverture: DoorOpen,
  action: Clock3,
  alerte: Bell,
}

export function ActivityTimeline({ activities, loading, error }: Props) {
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Chargement de l’historique...
      </p>
    )
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }
  if (!activities.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune activité à afficher.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.type] ?? Clock3
        return (
          <div
            key={activity.id}
            className="rounded-[3px] border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">{activity.title}</p>
                <p className="text-sm text-muted-foreground">
                  {activity.description}
                </p>
              </div>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {activity.date}
            </div>
          </div>
        )
      })}
    </div>
  )
}
