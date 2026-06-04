export type AlertType = string

export type Alerte = {
  id: string
  rawId: number
  type: AlertType
  description: string
  severity: string
  date: string
  status: string
}
