import { useAuthContext } from "@/contexts/auth-context"
import { useRole } from "@/hooks/useRole"
import { type Lamp } from "@/types/lamp"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

type LampUpdateMessage = {
  type: "lamp_update"
  id: number
  etat_lumiere: "allume" | "eteint"
}

function buildWsUrl(token: string): string {
  // En dev : passe par le proxy Vite (même host, même port)
  // En prod : même comportement si frontend et backend sont sur le même domaine
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/api/ws/lights?token=${encodeURIComponent(token)}`
}

export function useLampesWebSocket(): void {
  const { token } = useAuthContext()
  const { entrepriseId } = useRole()
  const qc = useQueryClient()

  useEffect(() => {
    if (!token || !entrepriseId) return

    const ws = new WebSocket(buildWsUrl(token))

    ws.onopen = () => {
      console.debug("[WS lights] connecté")
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as LampUpdateMessage
        if (data.type !== "lamp_update") return

        // Met à jour le cache TanStack Query sans refetch réseau
        qc.setQueryData(
          ["lampes", entrepriseId],
          (old: Lamp[] | undefined) => {
            if (!old) return old
            return old.map((lamp) =>
              lamp.rawId === data.id
                ? {
                    ...lamp,
                    state: (data.etat_lumiere === "allume"
                      ? "allumee"
                      : "eteinte") as Lamp["state"],
                  }
                : lamp
            )
          }
        )
      } catch {
        // payload non-JSON ou structure inattendue — on ignore
      }
    }

    ws.onerror = () => {
      console.warn("[WS lights] erreur de connexion")
    }

    ws.onclose = (e) => {
      console.debug(`[WS lights] fermé (code=${e.code})`)
    }

    // Keep-alive : envoie "ping" toutes les 30 s
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping")
    }, 30_000)

    return () => {
      clearInterval(ping)
      ws.close()
    }
  }, [token, entrepriseId, qc])
}
