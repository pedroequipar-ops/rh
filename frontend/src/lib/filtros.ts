import type { Candidato, Vaga, VagaStatus } from '../types'

export interface FiltrosVaga {
  q: string
  status: VagaStatus[]
  setor: string[]
  prioridade: string[]
  urgente: boolean
  atrasada: boolean
  motivo: string[]
  tags: string[]
  responsavel: string[]
}

export interface FiltrosCandidato {
  q: string
  etapa: string[]
  vaga: string
  setorVaga: string[]
  saidaNegativa: boolean
  tags: string[]
  responsavel: string[]
}

export const FILTROS_VAGA_VAZIO: FiltrosVaga = {
  q: '',
  status: [],
  setor: [],
  prioridade: [],
  urgente: false,
  atrasada: false,
  motivo: [],
  tags: [],
  responsavel: [],
}

export const FILTROS_CANDIDATO_VAZIO: FiltrosCandidato = {
  q: '',
  etapa: [],
  vaga: '',
  setorVaga: [],
  saidaNegativa: false,
  tags: [],
  responsavel: [],
}

/** minúsculo + sem acento, pra busca não sensível a caixa/acentuação. */
function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function predicadoVaga(filtros: FiltrosVaga): (vaga: Vaga) => boolean {
  const termo = normalizarTexto(filtros.q)
  return (vaga) => {
    if (termo && !normalizarTexto(vaga.titulo).includes(termo)) return false
    if (filtros.status.length && !filtros.status.includes(vaga.status)) return false
    if (filtros.setor.length && !filtros.setor.includes(vaga.setor.id)) return false
    if (filtros.prioridade.length && !filtros.prioridade.includes(String(vaga.prioridade))) return false
    if (filtros.urgente && !vaga.urgente) return false
    if (filtros.atrasada && !vaga.atrasada) return false
    if (filtros.motivo.length && !filtros.motivo.includes(vaga.motivo_solicitacao)) return false
    if (filtros.tags.length && !vaga.tags.some((t) => filtros.tags.includes(t.nome))) return false
    if (filtros.responsavel.length && !(vaga.responsavel && filtros.responsavel.includes(vaga.responsavel.id)))
      return false
    return true
  }
}

export function predicadoCandidato(filtros: FiltrosCandidato): (candidato: Candidato) => boolean {
  const termo = normalizarTexto(filtros.q)
  return (candidato) => {
    if (termo && !normalizarTexto(candidato.nome).includes(termo)) return false
    if (filtros.etapa.length && !filtros.etapa.includes(candidato.etapa_atual.id)) return false
    if (filtros.vaga && candidato.vaga_id !== filtros.vaga) return false
    if (filtros.setorVaga.length && !filtros.setorVaga.includes(candidato.vaga_setor)) return false
    if (filtros.saidaNegativa && !candidato.etapa_atual.is_saida_negativa) return false
    if (filtros.tags.length && !candidato.tags.some((t) => filtros.tags.includes(t.nome))) return false
    if (
      filtros.responsavel.length &&
      !(candidato.responsavel && filtros.responsavel.includes(candidato.responsavel.id))
    )
      return false
    return true
  }
}

// --- serialização filtros <-> URLSearchParams (CSV multivalor) -----------

function paramsToList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key)
  return raw ? raw.split(',').filter(Boolean) : []
}

function setListParam(params: URLSearchParams, key: string, list: string[]): void {
  if (list.length) params.set(key, list.join(','))
  else params.delete(key)
}

function setBoolParam(params: URLSearchParams, key: string, value: boolean): void {
  if (value) params.set(key, '1')
  else params.delete(key)
}

function setTextParam(params: URLSearchParams, key: string, value: string): void {
  if (value) params.set(key, value)
  else params.delete(key)
}

export function filtrosVagaFromParams(params: URLSearchParams): FiltrosVaga {
  return {
    q: params.get('q') ?? '',
    status: paramsToList(params, 'status') as VagaStatus[],
    setor: paramsToList(params, 'setor'),
    prioridade: paramsToList(params, 'prioridade'),
    urgente: params.get('urgente') === '1',
    atrasada: params.get('atrasada') === '1',
    motivo: paramsToList(params, 'motivo'),
    tags: paramsToList(params, 'tags'),
    responsavel: paramsToList(params, 'responsavel'),
  }
}

export function filtrosVagaToParams(filtros: FiltrosVaga, params: URLSearchParams): void {
  setTextParam(params, 'q', filtros.q)
  setListParam(params, 'status', filtros.status)
  setListParam(params, 'setor', filtros.setor)
  setListParam(params, 'prioridade', filtros.prioridade)
  setBoolParam(params, 'urgente', filtros.urgente)
  setBoolParam(params, 'atrasada', filtros.atrasada)
  setListParam(params, 'motivo', filtros.motivo)
  setListParam(params, 'tags', filtros.tags)
  setListParam(params, 'responsavel', filtros.responsavel)
}

export function filtrosCandidatoFromParams(params: URLSearchParams): FiltrosCandidato {
  return {
    q: params.get('q') ?? '',
    etapa: paramsToList(params, 'etapa'),
    vaga: params.get('vaga') ?? '',
    setorVaga: paramsToList(params, 'setorVaga'),
    saidaNegativa: params.get('saidaNegativa') === '1',
    tags: paramsToList(params, 'tags'),
    responsavel: paramsToList(params, 'responsavel'),
  }
}

export function filtrosCandidatoToParams(filtros: FiltrosCandidato, params: URLSearchParams): void {
  setTextParam(params, 'q', filtros.q)
  setListParam(params, 'etapa', filtros.etapa)
  setTextParam(params, 'vaga', filtros.vaga)
  setListParam(params, 'setorVaga', filtros.setorVaga)
  setBoolParam(params, 'saidaNegativa', filtros.saidaNegativa)
  setListParam(params, 'tags', filtros.tags)
  setListParam(params, 'responsavel', filtros.responsavel)
}
