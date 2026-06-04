import { X } from "lucide-react"
import { type ReactNode } from "react"
import { Button } from "./button"

type Props = {
  ouvert: boolean
  onFermer: () => void
  titre: string
  children: ReactNode
}

export function Modal({ ouvert, onFermer, titre, children }: Props) {
  if (!ouvert) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer() }}
    >
      <div className="w-full max-w-md rounded-[3px] border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{titre}</h2>
          <Button variant="ghost" size="icon" onClick={onFermer}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
