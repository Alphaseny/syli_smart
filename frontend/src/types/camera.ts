export type Camera = {
  id: string
  rawId: number
  bureauId: number
  name: string
  location: string
  isOnline: boolean
  streamUrl?: string
  snapshotUrl?: string
  enregistrementActif: boolean
}
