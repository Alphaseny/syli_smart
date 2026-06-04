export type DoorState = "ouverte" | "fermee"

export type Door = {
  id: string
  rawId: number
  bureauId: number
  name: string
  location: string
  state: DoorState
  lastActivity: string
  dureeOuvertureSec: number
}
