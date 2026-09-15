import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  aprovarVaga,
  cobrarVaga,
  createVaga,
  deleteVaga,
  getVaga,
  getVagaHistorico,
  listCandidatosDaVaga,
  listVagas,
  moverVagaEtapa,
  recusarVaga,
  registrarCandidaturas,
  restaurarVaga,
  sugerirTagsVaga,
  transicionarVaga,
  updateVaga,
  type AprovarVagaInput,
  type VagaInput,
} from '../vagas'
import { statusLabel } from '../../constants/vagaStatus'
import { useToast } from '../../context/ToastContext'
import type { EtapaKanban, Vaga, VagaStatus } from '../../types'
import { queryKeys } from '../queryKeys'

// --- queries -------------------------------------------------------------

export function useVagas() {
  return useQuery({ queryKey: queryKeys.vagasList, queryFn: () => listVagas() })
}

export function useVaga(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.vaga(id ?? ''),
    queryFn: () => getVaga(id as string),
    enabled: Boolean(id),
  })
}

export function useVagaHistorico(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.vagaHistorico(id ?? ''),
    queryFn: () => getVagaHistorico(id as string),
    enabled: Boolean(id),
  })
}

export function useCandidatosDaVaga(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.vagaCandidatos(id ?? ''),
    queryFn: () => listCandidatosDaVaga(id as string),
    enabled: Boolean(id),
  })
}

// --- helpers ------------------------------------------------------------

/** Grava uma vaga atualizada no cache da lista e do detalhe. */
export function aplicarVagaNoCache(qc: QueryClient, vaga: Vaga) {
  qc.setQueryData<Vaga[]>(queryKeys.vagasList, (old) =>
    old?.map((v) => (v.id === vaga.id ? vaga : v)),
  )
  qc.setQueryData(queryKeys.vaga(vaga.id), vaga)
}

// --- mutations otimistas (portadas de KanbanPage / ListagemPage) -------

export function useCreateVaga() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (input: VagaInput) => createVaga(input),
    onError: () => showToast('Não foi possível criar a vaga', 'error'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
    },
  })
}

export function useTransicionarVaga() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, para, observacao }: { id: string; para: VagaStatus; observacao?: string }) =>
      transicionarVaga(id, para, observacao),
    onMutate: async ({ id, para }) => {
      await qc.cancelQueries({ queryKey: queryKeys.vagas })
      const listaAnterior = qc.getQueryData<Vaga[]>(queryKeys.vagasList)
      const detalheAnterior = qc.getQueryData<Vaga>(queryKeys.vaga(id))
      qc.setQueryData<Vaga[]>(queryKeys.vagasList, (old) =>
        old?.map((v) => (v.id === id ? { ...v, status: para } : v)),
      )
      qc.setQueryData<Vaga>(queryKeys.vaga(id), (old) => (old ? { ...old, status: para } : old))
      return { listaAnterior, detalheAnterior, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        qc.setQueryData(queryKeys.vagasList, ctx.listaAnterior)
        qc.setQueryData(queryKeys.vaga(ctx.id), ctx.detalheAnterior)
      }
      showToast('Não foi possível mover a vaga', 'error')
    },
    onSuccess: (atualizada, { para }) => {
      aplicarVagaNoCache(qc, atualizada)
      if (para === 'CANCELADA' || para === 'ENCERRADA') {
        showToast('Vaga descartada')
        return
      }
      const labelToast = para === 'EM_TRIAGEM' ? 'Triagem' : statusLabel(para)
      showToast(`Vaga movida para "${labelToast}"`)
    },
    onSettled: (_data, _err, { id, para }) => {
      if (para === 'EM_TRIAGEM') {
        qc.invalidateQueries({ queryKey: queryKeys.vagas })
        qc.invalidateQueries({ queryKey: queryKeys.candidatos })
        qc.invalidateQueries({ queryKey: queryKeys.etapas })
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.vagasList })
        qc.invalidateQueries({ queryKey: queryKeys.vaga(id) })
      }
    },
  })
}

export function useMoverVagaEtapa() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, etapaId }: { id: string; etapaId: string }) => moverVagaEtapa(id, etapaId),
    onMutate: async ({ id, etapaId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.vagas })
      const listaAnterior = qc.getQueryData<Vaga[]>(queryKeys.vagasList)
      const detalheAnterior = qc.getQueryData<Vaga>(queryKeys.vaga(id))
      const etapa =
        qc.getQueryData<EtapaKanban[]>(queryKeys.etapas)?.find((e) => e.id === etapaId) ?? null
      qc.setQueryData<Vaga[]>(queryKeys.vagasList, (old) =>
        old?.map((v) => (v.id === id ? { ...v, etapa_atual: etapa } : v)),
      )
      qc.setQueryData<Vaga>(queryKeys.vaga(id), (old) =>
        old ? { ...old, etapa_atual: etapa } : old,
      )
      return { listaAnterior, detalheAnterior, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        qc.setQueryData(queryKeys.vagasList, ctx.listaAnterior)
        qc.setQueryData(queryKeys.vaga(ctx.id), ctx.detalheAnterior)
      }
      showToast('Não foi possível mover o card da vaga', 'error')
    },
    onSuccess: (atualizada) => aplicarVagaNoCache(qc, atualizada),
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
      qc.invalidateQueries({ queryKey: queryKeys.vaga(id) })
    },
  })
}

export function useUpdateVaga() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<VagaInput> }) =>
      updateVaga(id, input),
    onError: () => showToast('Não foi possível salvar', 'error'),
    onSuccess: (atualizada) => aplicarVagaNoCache(qc, atualizada),
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.vaga(id) })
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
    },
  })
}

export function useAprovarVaga() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: AprovarVagaInput }) =>
      aprovarVaga(id, input),
    onError: () => showToast('Não foi possível aprovar', 'error'),
    onSuccess: (atualizada) => {
      aplicarVagaNoCache(qc, atualizada)
      showToast('Vaga aprovada')
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.vaga(id) })
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
      qc.invalidateQueries({ queryKey: queryKeys.vagaHistorico(id) })
    },
  })
}

export function useRecusarVaga() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => recusarVaga(id, motivo),
    onError: () => showToast('Não foi possível recusar', 'error'),
    onSuccess: (atualizada) => {
      aplicarVagaNoCache(qc, atualizada)
      showToast('Vaga recusada')
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.vaga(id) })
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
      qc.invalidateQueries({ queryKey: queryKeys.vagaHistorico(id) })
    },
  })
}

export function useRegistrarCandidaturas() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, quantidade }: { id: string; quantidade: number }) =>
      registrarCandidaturas(id, quantidade),
    onError: () => showToast('Não foi possível registrar', 'error'),
    onSuccess: (atualizada) => {
      aplicarVagaNoCache(qc, atualizada)
      showToast('Candidaturas registradas no histórico')
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.vaga(id) })
      qc.invalidateQueries({ queryKey: queryKeys.vagaHistorico(id) })
    },
  })
}

export function useCobrarVaga() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, mensagem }: { id: string; mensagem?: string }) => cobrarVaga(id, mensagem),
    onError: () =>
      showToast('Não foi possível cobrar (você pode ser o responsável desta etapa)', 'error'),
    onSuccess: (enviadas) => showToast(`Cobrança enviada para ${enviadas} pessoa(s)`),
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.vaga(id) })
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
      qc.invalidateQueries({ queryKey: queryKeys.vagaHistorico(id) })
    },
  })
}

export function useDeleteVaga() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => deleteVaga(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.vagasList })
      const listaAnterior = qc.getQueryData<Vaga[]>(queryKeys.vagasList)
      qc.setQueryData<Vaga[]>(queryKeys.vagasList, (old) => old?.filter((v) => v.id !== id))
      return { listaAnterior }
    },
    onError: (_err, _id, ctx) => {
      if (ctx) qc.setQueryData(queryKeys.vagasList, ctx.listaAnterior)
      qc.invalidateQueries({ queryKey: queryKeys.vagasList })
      showToast('Não foi possível excluir a vaga', 'error')
    },
    onSuccess: (_data, id) =>
      showToast('Vaga excluída', 'success', {
        actionLabel: 'Desfazer',
        onAction: () =>
          restaurarVaga(id).finally(() => qc.invalidateQueries({ queryKey: queryKeys.vagasList })),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.vagasList }),
  })
}

export function useSugerirTagsVaga() {
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => sugerirTagsVaga(id),
    onError: () => showToast('Não foi possível sugerir tags agora', 'error'),
  })
}
