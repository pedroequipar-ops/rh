import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import type { VagaAtrasada } from '../../api/dashboard'
import { useAuth } from '../../context/AuthContext'
import { notificacaoHref } from '../../lib/notificacaoHref'

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface AtrasadasListProps {
  vagas: VagaAtrasada[]
}

/** Lista clicável de vagas atrasadas — abre o painel de detalhe da vaga. */
export function AtrasadasList({ vagas }: AtrasadasListProps) {
  const navigate = useNavigate()
  const { me } = useAuth()

  if (vagas.length === 0) {
    return <p className="text-sm text-slate-400">Nenhuma vaga atrasada.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {vagas.map((vaga) => (
        <button
          key={vaga.id}
          onClick={() => navigate(notificacaoHref(me?.role ?? 'RH', 'vaga', vaga.id))}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-fast hover:bg-red-50"
        >
          <AlertTriangle size={14} className="shrink-0 text-red-500" />
          <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{vaga.titulo}</span>
          <span className="shrink-0 text-xs text-slate-400">{vaga.setor}</span>
          <span className="shrink-0 text-xs font-medium text-red-600">
            {fmtData(vaga.data_alvo_preenchimento ?? vaga.data_inicio_prevista)}
          </span>
        </button>
      ))}
    </div>
  )
}
