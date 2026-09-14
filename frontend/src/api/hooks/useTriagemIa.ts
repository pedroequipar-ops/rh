import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adicionarCaixaEntradaEmail,
  atualizarCaixaEntradaEmail,
  decidirTriagemIa,
  getCaixasEntradaEmail,
  getTriagemIaConfig,
  iniciarConexaoGoogle,
  listTriagemIaDaVaga,
  listTriagemIaNaoRoteados,
  removerCaixaEntradaEmail,
  rotearTriagemIa,
  type CaixaEntradaEmailInput,
  type TriagemIaAcao,
} from '../triagemIa'
import { isAxiosError } from 'axios'
import { useToast } from '../../context/ToastContext'
import { queryKeys } from '../queryKeys'

export function useTriagemIaDaVaga(vagaId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.triagemIaVaga(vagaId ?? ''),
    queryFn: () => listTriagemIaDaVaga(vagaId as string),
    enabled: Boolean(vagaId) && enabled,
  })
}

export function useTriagemIaNaoRoteados(enabled = true) {
  return useQuery({
    queryKey: queryKeys.triagemIaNaoRoteados,
    queryFn: () => listTriagemIaNaoRoteados(),
    enabled,
  })
}

export function useTriagemIaConfig(vagaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.triagemIaConfig(vagaId),
    queryFn: () => getTriagemIaConfig(vagaId),
  })
}

export function useDecidirTriagemIa(vagaId: string) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, acao, motivo }: { id: string; acao: TriagemIaAcao; motivo?: string }) =>
      decidirTriagemIa(id, acao, motivo),
    onError: () => showToast('Não foi possível concluir a ação', 'error'),
    onSuccess: () => showToast('Candidato atualizado'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.triagemIaVaga(vagaId) })
      qc.invalidateQueries({ queryKey: queryKeys.candidatosList })
      qc.invalidateQueries({ queryKey: queryKeys.vagaCandidatos(vagaId) })
    },
  })
}

export function useRotearTriagemIa() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, vagaId }: { id: string; vagaId: string }) => rotearTriagemIa(id, vagaId),
    onError: () => showToast('Não foi possível rotear o e-mail', 'error'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.triagemIaNaoRoteados })
      qc.invalidateQueries({ queryKey: queryKeys.triagemIa })
    },
  })
}

export function useCaixasEntradaEmail() {
  return useQuery({
    queryKey: queryKeys.caixasEntradaEmail,
    queryFn: () => getCaixasEntradaEmail(),
  })
}

export function useAdicionarCaixaEntradaEmail() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (input: CaixaEntradaEmailInput) => adicionarCaixaEntradaEmail(input),
    onError: () => showToast('Não foi possível conectar a caixa de e-mail', 'error'),
    onSuccess: () => {
      showToast('Caixa de e-mail conectada')
      qc.invalidateQueries({ queryKey: queryKeys.caixasEntradaEmail })
    },
  })
}

export function useAtualizarCaixaEntradaEmail() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CaixaEntradaEmailInput> }) =>
      atualizarCaixaEntradaEmail(id, input),
    onError: () => showToast('Não foi possível atualizar a caixa de e-mail', 'error'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.caixasEntradaEmail }),
  })
}

export function useRemoverCaixaEntradaEmail() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => removerCaixaEntradaEmail(id),
    onError: () => showToast('Não foi possível remover a caixa de e-mail', 'error'),
    onSuccess: () => {
      showToast('Caixa de e-mail removida')
      qc.invalidateQueries({ queryKey: queryKeys.caixasEntradaEmail })
    },
  })
}

export function useConectarGoogle() {
  const { showToast } = useToast()
  return useMutation({
    mutationFn: () => iniciarConexaoGoogle(),
    onSuccess: ({ authorize_url }) => {
      window.location.href = authorize_url
    },
    onError: (err) => {
      const mensagem =
        (isAxiosError(err) && (err.response?.data as { detail?: string } | undefined)?.detail) ||
        'Não foi possível conectar com o Google'
      showToast(mensagem, 'error')
    },
  })
}
