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

/** Todas as tags da empresa (sem termo de busca) — usado pelo facetador de filtro. */
export function useTagsList() {
  return useQuery({
    queryKey: ['tags', 'list'],
    queryFn: () => buscarTags(''),
    staleTime: 30_000,
  })
}
