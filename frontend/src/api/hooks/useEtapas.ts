import { useQuery } from '@tanstack/react-query'
import { listEtapas } from '../etapas'
import { queryKeys } from '../queryKeys'

export function useEtapas() {
  return useQuery({ queryKey: queryKeys.etapas, queryFn: listEtapas })
}
