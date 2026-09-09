import { useState } from 'react'
import { AlarmClock, Bell, FileText, Flame, X } from 'lucide-react'
import clsx from 'clsx'
import { ActivityFeed } from '../atividade/ActivityFeed'
import { ChatPanel } from './ChatPanel'
import { InlineEdit, Tabs, TagInput } from '../ui'
import { useUpdateCandidato } from '../../api/hooks/useCandidatos'
import { getCurriculoUrl } from '../../api/candidatos'
import { PRIORIDADE_META, VAGA_STATUS_META } from '../../constants/vagaStatus'
import type { CandidatoInput } from '../../api/candidatos'
import type { Candidato } from '../../types'

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const CARIMBOS: { campo: keyof Candidato['vaga']; titulo: string }[] = [
  { campo: 'solicitada_em', titulo: 'Solicitada' },
  { campo: 'aprovada_em', titulo: 'Aprovada' },
  { campo: 'publicada_em', titulo: 'Publicada' },
  { campo: 'triagem_iniciada_em', titulo: 'Triagem iniciada' },
  { campo: 'encerrada_em', titulo: 'Candidaturas encerradas' },
]

type CampoPerfil = 'perfil_formacao' | 'perfil_experiencia' | 'perfil_habilidades' | 'perfil_certificacoes'

const SECOES_PERFIL: { campo: CampoPerfil; titulo: string }[] = [
  { campo: 'perfil_formacao', titulo: 'Formação' },
  { campo: 'perfil_experiencia', titulo: 'Experiência' },
  { campo: 'perfil_habilidades', titulo: 'Habilidades' },
  { campo: 'perfil_certificacoes', titulo: 'Certificações' },
]

interface CandidatoDetailPanelProps {
  candidato: Candidato
  onClose: () => void
}

export function CandidatoDetailPanel({ candidato, onClose }: CandidatoDetailPanelProps) {
  const updateCandidato = useUpdateCandidato()
  const [aba, setAba] = useState<'perfil' | 'conversa' | 'atividade'>('perfil')
  const [loadingCurriculo, setLoadingCurriculo] = useState(false)

  async function salvar(input: Partial<CandidatoInput>): Promise<void> {
    await updateCandidato.mutateAsync({ id: candidato.id, input })
  }

  async function handleAbrirCurriculo() {
    setLoadingCurriculo(true)
    try {
      const url = await getCurriculoUrl(candidato.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoadingCurriculo(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-2">
          <InlineEdit
            value={candidato.nome}
            onSave={(v) => salvar({ nome: v })}
            className="text-base font-semibold text-slate-800"
          />
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Candidato à vaga: {candidato.vaga_titulo}</p>
        <p className="text-xs text-slate-400">Setor: {candidato.vaga_setor}</p>
        <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {candidato.etapa_atual.nome}
        </span>
        <TagInput
          tags={candidato.tags}
          onChange={(nomes) => updateCandidato.mutate({ id: candidato.id, input: { tags: nomes } })}
          className="mt-2"
        />
      </div>

      <Tabs
        className="shrink-0 px-4"
        value={aba}
        onChange={(v) => setAba(v as typeof aba)}
        tabs={[
          { value: 'perfil', label: 'Perfil' },
          { value: 'conversa', label: 'Conversa' },
          { value: 'atividade', label: 'Atividade' },
        ]}
      />

      {aba === 'perfil' && (
        <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                E-mail
              </h3>
              <InlineEdit value={candidato.email} onSave={(v) => salvar({ email: v })} />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Telefone
              </h3>
              <InlineEdit value={candidato.telefone} onSave={(v) => salvar({ telefone: v })} />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                CPF
              </h3>
              <InlineEdit value={candidato.cpf} onSave={(v) => salvar({ cpf: v })} />
            </div>
            <div className="col-span-2">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                LinkedIn
              </h3>
              <InlineEdit
                value={candidato.linkedin_url ?? ''}
                placeholder="Não informado"
                onSave={(v) => salvar({ linkedin_url: v })}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Dados da vaga
            </h3>

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={clsx(
                  'rounded border px-2 py-0.5 text-xs font-medium',
                  VAGA_STATUS_META[candidato.vaga.status]?.badge,
                )}
              >
                {candidato.vaga.status_display}
              </span>
              <span
                className={clsx(
                  'rounded border px-2 py-0.5 text-xs font-medium',
                  PRIORIDADE_META[candidato.vaga.prioridade]?.badge,
                )}
              >
                Prioridade {candidato.vaga.prioridade_display}
              </span>
              {candidato.vaga.urgente && (
                <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  <Flame size={12} /> Urgente
                </span>
              )}
              {candidato.vaga.atrasada && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <AlarmClock size={12} /> Atrasada
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-600">
              <div>
                <dt className="text-xs text-slate-400">Início previsto</dt>
                <dd>{fmtData(candidato.vaga.data_inicio_prevista)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Prazo p/ preencher</dt>
                <dd>{fmtData(candidato.vaga.data_alvo_preenchimento)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Quantidade</dt>
                <dd>{candidato.vaga.quantidade_vagas} vaga(s)</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Salário</dt>
                <dd>{candidato.vaga.salario ? `R$ ${candidato.vaga.salario}` : '—'}</dd>
              </div>
              {candidato.vaga.motivo_solicitacao_display && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">Motivo da solicitação</dt>
                  <dd>{candidato.vaga.motivo_solicitacao_display}</dd>
                </div>
              )}
            </dl>

            <div>
              <h4 className="mb-1 text-xs font-medium text-slate-500">Linha do tempo</h4>
              <ol className="space-y-1 border-l border-slate-200 pl-3 text-xs text-slate-600">
                {CARIMBOS.filter(({ campo }) => candidato.vaga[campo]).map(({ campo, titulo }) => (
                  <li key={campo}>
                    <span className="font-medium text-slate-700">{titulo}</span> ·{' '}
                    {fmtData(candidato.vaga[campo] as string | null)}
                  </li>
                ))}
              </ol>
            </div>

            {candidato.vaga.total_cobrancas > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Bell size={12} className="text-slate-400" />
                {candidato.vaga.total_cobrancas} cobrança(s)
                {candidato.vaga.cobrada_em && ` · última em ${fmtData(candidato.vaga.cobrada_em)}`}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Resumo do perfil
            </h3>
            {SECOES_PERFIL.map(({ campo, titulo }) => (
              <div key={campo}>
                <h4 className="mb-0.5 text-xs font-medium text-slate-500">{titulo}</h4>
                <InlineEdit
                  value={candidato[campo] ?? ''}
                  type="textarea"
                  placeholder="Não informado"
                  onSave={(v) => salvar({ [campo]: v } as Partial<CandidatoInput>)}
                />
              </div>
            ))}
          </div>

          {candidato.curriculo_key && (
            <button
              onClick={handleAbrirCurriculo}
              disabled={loadingCurriculo}
              className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileText size={14} />
              {loadingCurriculo ? 'Gerando link...' : 'Abrir currículo'}
            </button>
          )}
        </div>
      )}

      {aba === 'conversa' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatPanel kind="candidato" id={candidato.id} />
        </div>
      )}

      {aba === 'atividade' && (
        <div className="min-h-0 flex-1">
          <ActivityFeed alvoTipo="candidato" alvoId={candidato.id} />
        </div>
      )}
    </div>
  )
}
