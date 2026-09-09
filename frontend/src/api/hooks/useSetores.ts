import { useQuery } from '@tanstack/react-query'
import { listSetores } from '../vagas'
import { queryKeys } from '../queryKeys'

export function useSetores(enabled = true) {
  return useQuery({ queryKey: queryKeys.setores, queryFn: listSetores, enabled })
}
