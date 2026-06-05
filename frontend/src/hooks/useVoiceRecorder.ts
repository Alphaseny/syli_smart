/**
 * Hook d'enregistrement audio — produit un WAV 16kHz mono 16-bit
 * compatible avec Vosk côté backend.
 */

import { useCallback, useRef, useState } from "react"

export type EtatEnregistrement = "inactif" | "enregistrement" | "traitement" | "erreur"

export type ResultatVoix = {
  transcription: string
  commande: string | null
  resultat: string
  message: string
  equipement_actionne: string | null
}

function encoderWav(pcmData: Float32Array, sampleRate: number): Blob {
  const numSamples = pcmData.length
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)

  function ecrire(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  function ecrire32(offset: number, val: number) { view.setUint32(offset, val, true) }
  function ecrire16(offset: number, val: number) { view.setUint16(offset, val, true) }

  ecrire(0, "RIFF")
  ecrire32(4, 36 + numSamples * 2)
  ecrire(8, "WAVE")
  ecrire(12, "fmt ")
  ecrire32(16, 16)
  ecrire16(20, 1)          // PCM
  ecrire16(22, 1)          // Mono
  ecrire32(24, sampleRate)
  ecrire32(28, sampleRate * 2)
  ecrire16(32, 2)
  ecrire16(34, 16)
  ecrire(36, "data")
  ecrire32(40, numSamples * 2)

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]))
    view.setInt16(44 + i * 2, s * 0x7fff, true)
  }

  return new Blob([buffer], { type: "audio/wav" })
}

export function useVoiceRecorder(langue: "fr" | "en" = "fr") {
  const [etat, setEtat] = useState<EtatEnregistrement>("inactif")
  const [resultat, setResultat] = useState<ResultatVoix | null>(null)
  const [erreur, setErreur] = useState<string>("")

  const contextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const samplesRef = useRef<Float32Array[]>([])

  const demarrer = useCallback(async () => {
    setErreur("")
    setResultat(null)
    samplesRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      contextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0)
        samplesRef.current.push(new Float32Array(data))
      }

      source.connect(processor)
      processor.connect(ctx.destination)

      setEtat("enregistrement")
    } catch (err) {
      setErreur("Microphone inaccessible. Vérifiez les permissions du navigateur.")
      setEtat("erreur")
    }
  }, [])

  const arreter = useCallback(async () => {
    if (etat !== "enregistrement") return
    setEtat("traitement")

    // Arrêter l'enregistrement
    processorRef.current?.disconnect()
    contextRef.current?.close()
    streamRef.current?.getTracks().forEach((t) => t.stop())

    // Assembler les échantillons PCM
    const totalSamples = samplesRef.current.reduce((acc, a) => acc + a.length, 0)
    const pcm = new Float32Array(totalSamples)
    let offset = 0
    for (const chunk of samplesRef.current) {
      pcm.set(chunk, offset)
      offset += chunk.length
    }

    // Encoder en WAV
    const wavBlob = encoderWav(pcm, 16000)

    // Envoyer au backend
    try {
      const token = (() => {
        try { return (JSON.parse(localStorage.getItem("smart_bureau_auth") ?? "{}") as { token?: string }).token ?? "" }
        catch { return "" }
      })()

      const form = new FormData()
      form.append("audio", wavBlob, "commande.wav")
      form.append("langue", langue)

      const res = await fetch("/api/voix/commande", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail ?? res.statusText)
      }

      const data = (await res.json()) as ResultatVoix
      setResultat(data)
      setEtat("inactif")
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur lors de l'envoi audio.")
      setEtat("erreur")
    }
  }, [etat, langue])

  return { etat, resultat, erreur, demarrer, arreter }
}
