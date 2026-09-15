import { useCallback, useRef, useState } from 'react'
import { analisarCurriculo, createCandidato, getUploadUrl, uploadCurriculo } from '../../api/candidatos'
import { pLimit } from '../../lib/pLimit'
import type { CandidatoExtraido } from '../../types'

const MAX_CURRICULO_SIZE_BYTES = 25 * 1024 * 1024
const MAX_ARQUIVOS_POR_IMPORTACAO = 30
const CONCORRENCIA = MAX_ARQUIVOS_POR_IMPORTACAO

export type LinhaStatus =
  | 'fila'
  | 'enviando'
  | 'analisando'
  | 'criando'
  | 'concluido'
  | 'erro'
  | 'cancelado'

export interface LinhaImportacao {
  id: string
  file: File
  status: LinhaStatus
  extraido?: CandidatoExtraido
  candidatoId?: string
  erro?: string
}

interface UseBulkImportOptions {
  vagaId: string
  etapaId?: string
  onCandidatoCriado?: () => void
}

/** Orquestra o upload em massa de currículos: fila com concorrência limitada
 * (`pLimit`), máquina de estados por arquivo (fila → enviando → analisando →
 * criando → concluído/erro), e retry por linha. */
export function useBulkImport({ vagaId, etapaId, onCandidatoCriado }: UseBulkImportOptions) {
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([])
  const canceladoRef = useRef(false)
  const limitarRef = useRef(pLimit(CONCORRENCIA))
  const totalAdicionadosRef = useRef(0)

  function atualizar(id: string, patch: Partial<LinhaImportacao>) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const processarLinha = useCallback(
    async (linha: LinhaImportacao) => {
      if (canceladoRef.current) {
        atualizar(linha.id, { status: 'cancelado' })
        return
      }
      try {
        atualizar(linha.id, { status: 'enviando', erro: undefined })
        const { upload_url, curriculo_key } = await getUploadUrl(
          linha.file.name,
          linha.file.type || 'application/pdf',
        )
        await uploadCurriculo(upload_url, linha.file)

        atualizar(linha.id, { status: 'analisando' })
        const extraido = await analisarCurriculo(curriculo_key)
        if (extraido.erro) {
          throw new Error('Não foi possível extrair os dados do currículo.')
        }

        if (canceladoRef.current) {
          atualizar(linha.id, { status: 'cancelado', extraido })
          return
        }

        atualizar(linha.id, { status: 'criando', extraido })
        const candidato = await createCandidato({
          nome: extraido.nome,
          email: extraido.email,
          telefone: extraido.telefone,
          cpf: extraido.cpf,
          linkedin_url: extraido.linkedin_url,
          perfil_formacao: extraido.perfil_formacao,
          perfil_experiencia: extraido.perfil_experiencia,
          perfil_habilidades: extraido.perfil_habilidades,
          perfil_certificacoes: extraido.perfil_certificacoes,
          curriculo_key,
          vaga_id: vagaId,
          ...(etapaId ? { etapa_atual_id: etapaId } : {}),
        })
        atualizar(linha.id, {
          status: 'concluido',
          candidatoId: candidato.id,
          extraido,
        })
        onCandidatoCriado?.()
      } catch (err) {
        atualizar(linha.id, {
          status: 'erro',
          erro: err instanceof Error ? err.message : 'Falha ao processar o currículo.',
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vagaId, etapaId, onCandidatoCriado],
  )

  const iniciar = useCallback(
    (files: File[]) => {
      canceladoRef.current = false
      const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      const dentroDoTamanho = pdfs.filter((f) => f.size <= MAX_CURRICULO_SIZE_BYTES)
      const espacoDisponivel = Math.max(MAX_ARQUIVOS_POR_IMPORTACAO - totalAdicionadosRef.current, 0)
      const aceitos = dentroDoTamanho.slice(0, espacoDisponivel)
      totalAdicionadosRef.current += aceitos.length

      const novasLinhas: LinhaImportacao[] = aceitos.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'fila',
      }))
      setLinhas((prev) => [...prev, ...novasLinhas])
      for (const linha of novasLinhas) {
        void limitarRef.current(() => processarLinha(linha))
      }

      return {
        ignoradosNaoPdf: files.length - pdfs.length,
        ignoradosMuitoGrandes: pdfs.length - dentroDoTamanho.length,
        ignoradosLimiteExcedido: dentroDoTamanho.length - aceitos.length,
      }
    },
    [processarLinha],
  )

  function cancelar() {
    canceladoRef.current = true
    setLinhas((prev) => prev.map((l) => (l.status === 'fila' ? { ...l, status: 'cancelado' } : l)))
  }

  function retry(id: string) {
    canceladoRef.current = false
    const linha = linhas.find((l) => l.id === id)
    if (!linha) return
    atualizar(id, { status: 'fila', erro: undefined })
    void limitarRef.current(() => processarLinha({ ...linha, status: 'fila' }))
  }

  function limpar() {
    setLinhas([])
    totalAdicionadosRef.current = 0
  }

  const resumo = {
    total: linhas.length,
    concluidos: linhas.filter((l) => l.status === 'concluido').length,
    erros: linhas.filter((l) => l.status === 'erro').length,
    cancelados: linhas.filter((l) => l.status === 'cancelado').length,
    emAndamento: linhas.filter((l) => ['fila', 'enviando', 'analisando', 'criando'].includes(l.status)).length,
  }

  return { linhas, iniciar, cancelar, retry, limpar, resumo }
}
