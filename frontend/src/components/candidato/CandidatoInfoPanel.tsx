import { useState } from 'react'
import { FileText, Link, Mail, Phone } from 'lucide-react'
import { getCurriculoUrl } from '../../api/candidatos'
import type { Candidato } from '../../types'

interface CandidatoInfoPanelProps {
  candidato: Candidato
}

export function CandidatoInfoPanel({ candidato }: CandidatoInfoPanelProps) {
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
    <div className="space-y-5 overflow-y-auto p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{candidato.nome}</h2>
        <p className="text-sm text-slate-500">Candidato à vaga: {candidato.vaga_titulo}</p>
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
        <p className="text-xs text-slate-400">CPF: {candidato.cpf}</p>
      </div>

      {candidato.resumo_perfil && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Resumo do perfil
          </h3>
          <p className="whitespace-pre-line text-sm text-slate-600">{candidato.resumo_perfil}</p>
        </div>
      )}

      <button
        onClick={handleAbrirCurriculo}
        disabled={loadingCurriculo}
        className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <FileText size={14} />
        {loadingCurriculo ? 'Gerando link...' : 'Abrir currículo'}
      </button>
    </div>
  )
}
