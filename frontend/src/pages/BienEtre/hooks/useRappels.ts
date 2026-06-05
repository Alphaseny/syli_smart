import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  creerRappel,
  modifierRappel,
  recupererRappels,
  recupererSuggestionsHabitudes,
  supprimerRappel,
  type NouveauRappel,
} from "../services/bienetre.service"

export function useRappels() {
  return useQuery({
    queryKey: ["rappels"],
    queryFn: recupererRappels,
    staleTime: 1000 * 30,
  })
}

export function useSuggestionsHabitudes() {
  return useQuery({
    queryKey: ["habitudes"],
    queryFn: recupererSuggestionsHabitudes,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreerRappel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NouveauRappel) => creerRappel(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rappels"] }),
  })
}

export function useMarquerExecute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => modifierRappel(id, { execute: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rappels"] }),
  })
}

export function useSupprimerRappel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: supprimerRappel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rappels"] }),
  })
}
