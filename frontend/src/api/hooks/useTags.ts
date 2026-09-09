import { useQuery } from '@tanstack/react-query'
import { buscarTags } from '../tags'

export function useTagsAutocomplete(q: string) {
  const termo = q.trim()
  return useQuery({
    queryKey: ['tags', 'autocomplete', termo],
    queryFn: () => buscarTags(termo),
    enabled: termo.length > 0,
    staleTime: 10_000,
  })
}
