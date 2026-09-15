import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { criarComentario, getAtividadeFeed, type AtividadeAlvoTipo } from '../atividade'
import { useToast } from '../../context/ToastContext'

function feedKey(alvoTipo: AtividadeAlvoTipo, alvoId: string) {
  return ['atividade', alvoTipo, alvoId] as const
}

export function useAtividadeFeed(alvoTipo: AtividadeAlvoTipo, alvoId: string | undefined) {
  return useQuery({
    queryKey: feedKey(alvoTipo, alvoId ?? ''),
    queryFn: () => getAtividadeFeed(alvoTipo, alvoId as string),
    enabled: Boolean(alvoId),
    // painel fica aberto junto do chat por bastante tempo; sem polling as
    // atualizações de outros usuários (mudança de etapa etc.) só apareceriam
    // reabrindo o painel
    refetchInterval: 15000,
  })
}

export function useCriarComentario(alvoTipo: AtividadeAlvoTipo, alvoId: string) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (texto: string) => criarComentario({ alvo_tipo: alvoTipo, alvo_id: alvoId, texto }),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedKey(alvoTipo, alvoId) }),
    onError: () => showToast('Não foi possível comentar', 'error'),
  })
}
