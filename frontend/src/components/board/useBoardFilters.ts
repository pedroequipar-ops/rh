import { useSearchParams } from 'react-router-dom'
import {
  FILTROS_CANDIDATO_VAZIO,
  FILTROS_VAGA_VAZIO,
  filtrosCandidatoFromParams,
  filtrosCandidatoToParams,
  filtrosVagaFromParams,
  filtrosVagaToParams,
  predicadoCandidato,
  predicadoVaga,
  type FiltrosCandidato,
  type FiltrosVaga,
} from '../../lib/filtros'
import type { Candidato, Vaga } from '../../types'

function contarAtivos(filtros: FiltrosVaga | FiltrosCandidato): number {
  return Object.entries(filtros as unknown as Record<string, unknown>).filter(([chave, valor]) => {
    if (chave === 'q') return false
    if (typeof valor === 'boolean') return valor
    if (Array.isArray(valor)) return valor.length > 0
    if (typeof valor === 'string') return valor.length > 0
    return false
  }).length
}

export interface UseBoardFiltersVaga {
  kind: 'vagas'
  filters: FiltrosVaga
  setFilter: <K extends keyof FiltrosVaga>(key: K, value: FiltrosVaga[K]) => void
  toggleInList: (
    key: 'status' | 'setor' | 'prioridade' | 'motivo' | 'tags' | 'responsavel',
    value: string,
  ) => void
  clear: () => void
  activeCount: number
  apply: (items: Vaga[]) => Vaga[]
}

export interface UseBoardFiltersPessoas {
  kind: 'pessoas'
  filters: FiltrosCandidato
  setFilter: <K extends keyof FiltrosCandidato>(key: K, value: FiltrosCandidato[K]) => void
  toggleInList: (key: 'etapa' | 'setorVaga' | 'tags' | 'responsavel', value: string) => void
  clear: () => void
  activeCount: number
  apply: (items: Candidato[]) => Candidato[]
}

export function useBoardFilters(kind: 'vagas'): UseBoardFiltersVaga
export function useBoardFilters(kind: 'pessoas'): UseBoardFiltersPessoas
export function useBoardFilters(kind: 'vagas' | 'pessoas'): UseBoardFiltersVaga | UseBoardFiltersPessoas {
  const [params, setParams] = useSearchParams()

  if (kind === 'vagas') {
    const filters = filtrosVagaFromParams(params)

    function setFilter<K extends keyof FiltrosVaga>(key: K, value: FiltrosVaga[K]) {
      const next = { ...filters, [key]: value }
      const updated = new URLSearchParams(params)
      filtrosVagaToParams(next, updated)
      setParams(updated, { replace: true })
    }

    function toggleInList(
      key: 'status' | 'setor' | 'prioridade' | 'motivo' | 'tags' | 'responsavel',
      value: string,
    ) {
      const atual = filters[key]
      const next = atual.includes(value as never)
        ? atual.filter((v) => v !== value)
        : [...atual, value]
      setFilter(key, next as FiltrosVaga[typeof key])
    }

    function clear() {
      const updated = new URLSearchParams(params)
      filtrosVagaToParams(FILTROS_VAGA_VAZIO, updated)
      setParams(updated, { replace: true })
    }

    return {
      kind: 'vagas',
      filters,
      setFilter,
      toggleInList,
      clear,
      activeCount: contarAtivos(filters),
      apply: (items) => items.filter(predicadoVaga(filters)),
    }
  }

  const filters = filtrosCandidatoFromParams(params)

  function setFilter<K extends keyof FiltrosCandidato>(key: K, value: FiltrosCandidato[K]) {
    const next = { ...filters, [key]: value }
    const updated = new URLSearchParams(params)
    filtrosCandidatoToParams(next, updated)
    setParams(updated, { replace: true })
  }

  function toggleInList(key: 'etapa' | 'setorVaga' | 'tags' | 'responsavel', value: string) {
    const atual = filters[key]
    const next = atual.includes(value) ? atual.filter((v) => v !== value) : [...atual, value]
    setFilter(key, next)
  }

  function clear() {
    const updated = new URLSearchParams(params)
    filtrosCandidatoToParams(FILTROS_CANDIDATO_VAZIO, updated)
    setParams(updated, { replace: true })
  }

  return {
    kind: 'pessoas',
    filters,
    setFilter,
    toggleInList,
    clear,
    activeCount: contarAtivos(filters),
    apply: (items) => items.filter(predicadoCandidato(filters)),
  }
}
