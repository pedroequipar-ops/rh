import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listSetores } from '../vagas'
import { createSetor, deleteSetor, restaurarSetor, updateSetor, type SetorInput } from '../accounts'
import { useToast } from '../../context/ToastContext'
import { queryKeys } from '../queryKeys'

export function useSetores(enabled = true) {
  return useQuery({ queryKey: queryKeys.setores, queryFn: listSetores, enabled })
}

export function useCreateSetor() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (input: SetorInput) => createSetor(input),
    onError: () => showToast('Não foi possível criar o setor', 'error'),
    onSuccess: () => showToast('Setor criado'),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.setores }),
  })
}

export function useUpdateSetor() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SetorInput }) => updateSetor(id, input),
    onError: () => showToast('Não foi possível salvar o setor', 'error'),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.setores }),
  })
}

export function useDeleteSetor() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => deleteSetor(id),
    onError: () => showToast('Não foi possível excluir o setor', 'error'),
    onSuccess: (_data, id) =>
      showToast('Setor excluído', 'success', {
        actionLabel: 'Desfazer',
        onAction: () =>
          restaurarSetor(id).finally(() => qc.invalidateQueries({ queryKey: queryKeys.setores })),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.setores }),
  })
}
