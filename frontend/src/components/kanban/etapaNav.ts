import type { Candidato, EtapaKanban } from '../../types'

export function ordenarEtapas(etapas: EtapaKanban[]): EtapaKanban[] {
  return [...etapas].sort((a, b) => {
    if (a.is_saida_negativa !== b.is_saida_negativa) return a.is_saida_negativa ? 1 : -1
    return a.ordem - b.ordem
  })
}

/** Próxima etapa "de avanço" (não-saída) depois da etapa atual do candidato, ou null se já é a última. */
export function proximaEtapa(candidato: Candidato, etapas: EtapaKanban[]): EtapaKanban | null {
  const avanco = ordenarEtapas(etapas).filter((e) => !e.is_saida_negativa)
  const atual = avanco.findIndex((e) => e.id === candidato.etapa_atual.id)
  if (atual === -1 || atual + 1 >= avanco.length) return null
  return avanco[atual + 1]
}

export function etapaSaidaNegativa(etapas: EtapaKanban[]): EtapaKanban | null {
  return etapas.find((e) => e.is_saida_negativa) ?? null
}
