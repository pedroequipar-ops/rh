import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getEmpresa, updateEmpresa } from '../accounts'
import { useToast } from '../../context/ToastContext'
import { queryKeys } from '../queryKeys'

export function useEmpresa() {
  return useQuery({ queryKey: queryKeys.empresa, queryFn: getEmpresa })
}

export function useUpdateEmpresa() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (nome: string) => updateEmpresa(nome),
    onError: () => showToast('Não foi possível salvar', 'error'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.empresa }),
  })
}
