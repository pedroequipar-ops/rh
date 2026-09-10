import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  concluirTarefa,
  createTarefa,
  deleteTarefa,
  listTarefas,
  reabrirTarefa,
  updateTarefa,
  type ListTarefasParams,
  type TarefaInput,
} from '../tarefas'
import { useToast } from '../../context/ToastContext'
import { queryKeys } from '../queryKeys'

export function useTarefas(params: ListTarefasParams = {}) {
  return useQuery({
    queryKey: queryKeys.tarefasList(params),
    queryFn: () => listTarefas(params),
  })
}

function useInvalidateTarefas() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.tarefas })
}

export function useCreateTarefa() {
  const invalidate = useInvalidateTarefas()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (input: TarefaInput) => createTarefa(input),
    onError: () => showToast('Não foi possível criar a tarefa', 'error'),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateTarefa() {
  const invalidate = useInvalidateTarefas()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TarefaInput> }) =>
      updateTarefa(id, input),
    onError: () => showToast('Não foi possível salvar a tarefa', 'error'),
    onSuccess: () => invalidate(),
  })
}

export function useConcluirTarefa() {
  const invalidate = useInvalidateTarefas()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => concluirTarefa(id),
    onError: () => showToast('Não foi possível concluir a tarefa', 'error'),
    onSuccess: () => invalidate(),
  })
}

export function useReabrirTarefa() {
  const invalidate = useInvalidateTarefas()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => reabrirTarefa(id),
    onError: () => showToast('Não foi possível reabrir a tarefa', 'error'),
    onSuccess: () => invalidate(),
  })
}

export function useDeleteTarefa() {
  const invalidate = useInvalidateTarefas()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (id: string) => deleteTarefa(id),
    onError: () => showToast('Não foi possível excluir a tarefa', 'error'),
    onSuccess: () => invalidate(),
  })
}
