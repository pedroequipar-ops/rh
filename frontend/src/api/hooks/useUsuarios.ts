import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createUsuario,
  deleteUsuario,
  listUsuarios,
  restaurarUsuario,
  updateUsuario,
  type UsuarioInput,
  type UsuarioUpdateInput,
} from '../accounts'
import { useToast } from '../../context/ToastContext'
import { queryKeys } from '../queryKeys'

export function useUsuarios(enabled = true) {
  return useQuery({ queryKey: queryKeys.usuarios, queryFn: listUsuarios, enabled })
}

export function useCreateUsuario() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (input: UsuarioInput) => createUsuario(input),
    onError: () => showToast('Não foi possível criar o usuário', 'error'),
    onSuccess: () => showToast('Usuário criado'),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.usuarios }),
  })
}

export function useUpdateUsuario() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UsuarioUpdateInput }) => updateUsuario(id, input),
    onError: () => showToast('Não foi possível salvar o usuário', 'error'),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.usuarios }),
  })
}

export function useDeleteUsuario() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => deleteUsuario(id),
    onError: () => showToast('Não foi possível excluir o usuário', 'error'),
    onSuccess: (_data, id) =>
      showToast('Usuário excluído', 'success', {
        actionLabel: 'Desfazer',
        onAction: () =>
          restaurarUsuario(id).finally(() => qc.invalidateQueries({ queryKey: queryKeys.usuarios })),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.usuarios }),
  })
}
