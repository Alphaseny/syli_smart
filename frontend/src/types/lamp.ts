export type LampState = "allumee" | "eteinte"

export type Lamp = {
  id: string
  rawId: number
  bureauId: number
  name: string
  location: string
  state: LampState
}
