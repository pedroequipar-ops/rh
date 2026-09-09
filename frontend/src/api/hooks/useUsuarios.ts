import { useQuery } from '@tanstack/react-query'
import { listUsuarios } from '../accounts'
import { queryKeys } from '../queryKeys'

export function useUsuarios(enabled = true) {
  return useQuery({ queryKey: queryKeys.usuarios, queryFn: listUsuarios, enabled })
}
