import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  buscarCandidatosComIa,
  createCandidato,
  deleteCandidato,
  getCandidato,
  listCandidatos,
  moverEtapa,
  restaurarCandidato,
  updateCandidato,
  type CandidatoInput,
} from '../candidatos'
import { useToast } from '../../context/ToastContext'
import type { Candidato, EtapaKanban } from '../../types'
import { queryKeys } from '../queryKeys'

/** Grava um candidato atualizado no cache da lista e do detalhe. */
function aplicarCandidatoNoCache(qc: QueryClient, candidato: Candidato) {
  qc.setQueryData<Candidato[]>(queryKeys.candidatosList, (old) =>
    old?.map((c) => (c.id === candidato.id ? candidato : c)),
  )
  qc.setQueryData(queryKeys.candidato(candidato.id), candidato)
}

// --- queries -------------------------------------------------------------

export function useCandidatos() {
  return useQuery({ queryKey: queryKeys.candidatosList, queryFn: () => listCandidatos() })
}

export function useCandidato(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.candidato(id ?? ''),
    queryFn: () => getCandidato(id as string),
    enabled: Boolean(id),
  })
}

export function useBuscaCandidatosIa() {
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (frase: string) => buscarCandidatosComIa(frase),
    onError: () => showToast('Não foi possível interpretar essa busca agora', 'error'),
  })
}

// --- mutations otimistas (portadas de KanbanPage / ListagemPage) -------

export function useCreateCandidato() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (input: CandidatoInput) => createCandidato(input),
    onError: () => showToast('Não foi possível salvar o candidato', 'error'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.candidatosList })
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
    },
  })
}

export function useMoverEtapaCandidato() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, etapaId, motivo }: { id: string; etapaId: string; motivo?: string }) =>
      moverEtapa(id, etapaId, motivo),
    onMutate: async ({ id, etapaId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.candidatos })
      const listaAnterior = qc.getQueryData<Candidato[]>(queryKeys.candidatosList)
      const detalheAnterior = qc.getQueryData<Candidato>(queryKeys.candidato(id))
      const etapa = qc
        .getQueryData<EtapaKanban[]>(queryKeys.etapas)
        ?.find((e) => e.id === etapaId)
      if (etapa) {
        qc.setQueryData<Candidato[]>(queryKeys.candidatosList, (old) =>
          old?.map((c) => (c.id === id ? { ...c, etapa_atual: etapa } : c)),
        )
        qc.setQueryData<Candidato>(queryKeys.candidato(id), (old) =>
          old ? { ...old, etapa_atual: etapa } : old,
        )
      }
      return { listaAnterior, detalheAnterior, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        qc.setQueryData(queryKeys.candidatosList, ctx.listaAnterior)
        qc.setQueryData(queryKeys.candidato(ctx.id), ctx.detalheAnterior)
      }
      showToast('Não foi possível mover o candidato', 'error')
    },
    onSuccess: (atualizado) => {
      qc.setQueryData<Candidato[]>(queryKeys.candidatosList, (old) =>
        old?.map((c) => (c.id === atualizado.id ? atualizado : c)),
      )
      qc.setQueryData(queryKeys.candidato(atualizado.id), atualizado)
      if (atualizado.etapa_atual.is_saida_negativa) showToast('Candidato descartado')
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.candidatosList })
      qc.invalidateQueries({ queryKey: queryKeys.candidato(id) })
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
    },
  })
}

export function useUpdateCandidato() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CandidatoInput> }) =>
      updateCandidato(id, input),
    onError: () => showToast('Não foi possível salvar', 'error'),
    onSuccess: (atualizado) => aplicarCandidatoNoCache(qc, atualizado),
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.candidato(id) })
      qc.invalidateQueries({ queryKey: queryKeys.candidatosList })
    },
  })
}

export function useDeleteCandidato() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => deleteCandidato(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.candidatosList })
      const listaAnterior = qc.getQueryData<Candidato[]>(queryKeys.candidatosList)
      qc.setQueryData<Candidato[]>(queryKeys.candidatosList, (old) =>
        old?.filter((c) => c.id !== id),
      )
      return { listaAnterior }
    },
    onError: (_err, _id, ctx) => {
      if (ctx) qc.setQueryData(queryKeys.candidatosList, ctx.listaAnterior)
      qc.invalidateQueries({ queryKey: queryKeys.candidatosList })
      showToast('Não foi possível excluir o candidato', 'error')
    },
    onSuccess: (_data, id) =>
      showToast('Candidato excluído', 'success', {
        actionLabel: 'Desfazer',
        onAction: () =>
          restaurarCandidato(id).finally(() =>
            qc.invalidateQueries({ queryKey: queryKeys.candidatosList }),
          ),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.candidatosList }),
  })
}
