import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Link, Mail, Pencil, Phone } from 'lucide-react'
import { getCurriculoUrl } from '../../api/candidatos'
import { useAuth } from '../../context/AuthContext'
import type { Candidato } from '../../types'

interface CandidatoInfoPanelProps {
  candidato: Candidato
}

const SECOES_PERFIL: { campo: keyof Candidato; titulo: string }[] = [
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
