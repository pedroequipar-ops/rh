import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, Bell, FileText, Flame, Link, Mail, Pencil, Phone } from 'lucide-react'
import clsx from 'clsx'
import { getCurriculoUrl } from '../../api/candidatos'
import { useAuth } from '../../context/AuthContext'
import { PRIORIDADE_META, VAGA_STATUS_META } from '../../constants/vagaStatus'
import type { Candidato } from '../../types'

interface CandidatoInfoPanelProps {
  candidato: Candidato
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const CARIMBOS: { campo: keyof Candidato['vaga']; titulo: string }[] = [
  { campo: 'solicitada_em', titulo: 'Solicitada' },
  { campo: 'aprovada_em', titulo: 'Aprovada' },
  { campo: 'publicada_em', titulo: 'Publicada' },
  { campo: 'triagem_iniciada_em', titulo: 'Triagem iniciada' },
  { campo: 'encerrada_em', titulo: 'Candidaturas encerradas' },
]

type CampoPerfil =
  | 'perfil_formacao'
  | 'perfil_experiencia'
  | 'perfil_habilidades'
  | 'perfil_certificacoes'

const SECOES_PERFIL: { campo: CampoPerfil; titulo: string }[] = [
  { campo: 'perfil_formacao', titulo: 'Formação' },
  { campo: 'perfil_experiencia', titulo: 'Experiência' },
  { campo: 'perfil_habilidades', titulo: 'Habilidades' },
  { campo: 'perfil_certificacoes', titulo: 'Certificações' },
]

export function CandidatoInfoPanel({ candidato }: CandidatoInfoPanelProps) {
  const navigate = useNavigate()
  const { me } = useAuth()
  const [loadingCurriculo, setLoadingCurriculo] = useState(false)

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
    <div className="h-full space-y-5 overflow-y-auto p-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">{candidato.nome}</h2>
          {me?.role === 'RH' && (
            <button
              onClick={() => navigate(`/rh/candidatos/${candidato.id}/editar`)}
              className="flex shrink-0 items-center gap-1.5 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              <Pencil size={12} />
              Editar
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500">Candidato à vaga: {candidato.vaga_titulo}</p>
        <p className="text-xs text-slate-400">Setor: {candidato.vaga_setor}</p>
        <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {candidato.etapa_atual.nome}
        </span>
      </div>

      <div className="space-y-2 text-sm text-slate-700">
        <p className="flex items-center gap-2">
          <Mail size={14} className="text-slate-400" />
          {candidato.email}
        </p>
        <p className="flex items-center gap-2">
          <Phone size={14} className="text-slate-400" />
          {candidato.telefone}
        </p>
        {candidato.linkedin_url && (
          <p className="flex items-center gap-2">
            <Link size={14} className="text-slate-400" />
            <a
              href={candidato.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              {candidato.linkedin_url}
            </a>
          </p>
        )}
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

      {SECOES_PERFIL.some(({ campo }) => candidato[campo]) && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Resumo do perfil
          </h3>
          {SECOES_PERFIL.map(
            ({ campo, titulo }) =>
              candidato[campo] && (
                <div key={campo}>
                  <h4 className="mb-0.5 text-xs font-medium text-slate-500">{titulo}</h4>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                    {candidato[campo]}
                  </p>
                </div>
              ),
          )}
        </div>
      )}

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
  )
}
