/**
 * Bouton de commande vocale — flottant en bas à droite du dashboard.
 * Maintenir appuyé pour enregistrer, relâcher pour envoyer.
 */

import { CheckCircle, Mic, MicOff, Loader2, AlertCircle } from "lucide-react"
import { useState } from "react"
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder"

export function VoiceControl() {
  const [langue, setLangue] = useState<"fr" | "en">("fr")
  const { etat, resultat, erreur, demarrer, arreter } = useVoiceRecorder(langue)

  const couleur = {
    inactif:       "bg-primary hover:bg-primary/90",
    enregistrement:"bg-red-500 hover:bg-red-600 animate-pulse",
    traitement:    "bg-orange-500",
    erreur:        "bg-destructive",
  }[etat]

  const icone = {
    inactif:       <Mic className="h-6 w-6" />,
    enregistrement:<MicOff className="h-6 w-6" />,
    traitement:    <Loader2 className="h-6 w-6 animate-spin" />,
    erreur:        <AlertCircle className="h-6 w-6" />,
  }[etat]

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">

      {/* Résultat ou erreur */}
      {(resultat || erreur) && (
        <div className={`max-w-xs rounded-[3px] border px-4 py-3 text-sm shadow-lg ${
          erreur
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : resultat?.resultat === "succes"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-border bg-card text-foreground"
        }`}>
          {erreur ? (
            <p>{erreur}</p>
          ) : resultat ? (
            <div className="space-y-1">
              {resultat.transcription && (
                <p className="text-xs text-muted-foreground italic">« {resultat.transcription} »</p>
              )}
              <div className="flex items-center gap-1.5">
                {resultat.resultat === "succes" && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                <p className="font-medium">{resultat.message}</p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Sélecteur de langue */}
      <div className="flex overflow-hidden rounded-[3px] border border-border bg-card text-xs shadow">
        <button
          type="button"
          onClick={() => setLangue("fr")}
          className={`px-3 py-1.5 font-medium transition ${langue === "fr" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          FR
        </button>
        <button
          type="button"
          onClick={() => setLangue("en")}
          className={`px-3 py-1.5 font-medium transition ${langue === "en" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          EN
        </button>
      </div>

      {/* Bouton micro principal */}
      <button
        type="button"
        onMouseDown={demarrer}
        onMouseUp={arreter}
        onTouchStart={demarrer}
        onTouchEnd={arreter}
        disabled={etat === "traitement"}
        title={
          etat === "inactif"        ? "Maintenir pour parler" :
          etat === "enregistrement" ? "Relâcher pour envoyer" :
          etat === "traitement"     ? "Traitement en cours..."  : "Erreur"
        }
        className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition ${couleur} disabled:opacity-70 select-none`}
      >
        {icone}
      </button>

      {/* Indication */}
      <p className="text-xs text-muted-foreground">
        {etat === "inactif"        && "Maintenir pour parler"}
        {etat === "enregistrement" && "Parlez maintenant..."}
        {etat === "traitement"     && "Analyse..."}
        {etat === "erreur"         && "Erreur"}
      </p>
    </div>
  )
}
