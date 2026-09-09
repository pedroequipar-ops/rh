import { ArrowRightLeft, History, MessageCircle } from 'lucide-react'
import type { AtividadeFeedItem } from '../../api/atividade'

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ICONES = {
  atividade: ArrowRightLeft,
  historico: History,
  comentario: MessageCircle,
} as const

/** Um item do feed unificado: atividade do sistema, transição legada ou comentário. */
export function ComentarioItem({ item }: { item: AtividadeFeedItem }) {
  const Icone = ICONES[item.tipo]
  return (
    <div className="flex gap-2.5 text-sm">
      <Icone size={14} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-slate-700">
          <span className="font-medium text-slate-800">{item.autor}</span>{' '}
          {item.tipo === 'comentario' ? `comentou: "${item.descricao}"` : item.descricao}
        </p>
        <p className="text-xs text-slate-400">{fmtDataHora(item.created_at)}</p>
      </div>
    </div>
  )
}
