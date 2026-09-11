import { useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, Bell, Clock, Flame, Users } from 'lucide-react'
import clsx from 'clsx'
import type { Vaga, VagaStatus } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Label } from '../ui/Label'
import { tempoDecorrido } from '../../lib/tempoRelativo'

const MAX_TAGS_VISIVEIS = 3

function TagChips({ tags }: { tags: Vaga['tags'] }) {
  if (!tags || tags.length === 0) return null
  const visiveis = tags.slice(0, MAX_TAGS_VISIVEIS)
  const restantes = tags.length - visiveis.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visiveis.map((tag) => (
        <Label key={tag.id} color={tag.cor} className="text-[10px]">
          {tag.nome}
        </Label>
      ))}
      {restantes > 0 && <span className="text-[10px] text-slate-400">+{restantes}</span>}
    </div>
  )
}

function posicoesLabel(qtd: number): string {
  return qtd === 1 ? '1 posição' : `${qtd} posições`
}

/** Contagem de pessoas relevante ao status: no funil, recebidas ou candidaturas. */
function contagemPessoas(vaga: Vaga): string | null {
  if (vaga.status === 'EM_TRIAGEM') {
    return `${vaga.qtd_pessoas_fase} no funil`
  }
  if (vaga.status === 'PUBLICADA' && vaga.qtd_pessoas_fase > 0) {
    return `${vaga.qtd_pessoas_fase} recebidas`
  }
  if (vaga.total_candidatos > 0) {
    return vaga.total_candidatos === 1 ? '1 candidatura' : `${vaga.total_candidatos} candidaturas`
  }
  return null
}

const DATA_ANCORA: Partial<Record<VagaStatus, { campo: keyof Vaga; verbo: string }>> = {
  SOLICITADA: { campo: 'solicitada_em', verbo: 'solicitada' },
  APROVADA: { campo: 'aprovada_em', verbo: 'aprovada' },
  PUBLICADA: { campo: 'publicada_em', verbo: 'publicada' },
  ENCERRADA: { campo: 'encerrada_em', verbo: 'encerrada' },
  EM_TRIAGEM: { campo: 'triagem_iniciada_em', verbo: 'em triagem' },
}

/** "solicitada há 2 dias" — âncora temporal do status atual, se houver data. */
function dataDoStatus(vaga: Vaga): string | null {
  const ancora = DATA_ANCORA[vaga.status]
  if (!ancora) return null
  const iso = vaga[ancora.campo]
  if (typeof iso !== 'string' || !iso) return null
  return `${ancora.verbo} ${tempoDecorrido(iso)}`
}

export function VagaKanbanCardContent({ vaga }: { vaga: Vaga }) {
  const contagem = contagemPessoas(vaga)
  const data = dataDoStatus(vaga)
  const prioridadeAlta = vaga.prioridade === 3 && !vaga.urgente

  return (
    <>
      <TagChips tags={vaga.tags} />
      <p className="text-xs font-semibold leading-snug text-slate-800">{vaga.titulo}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {vaga.setor.nome} · {posicoesLabel(vaga.quantidade_vagas)}
      </p>

      <div className="mt-1.5 flex items-end justify-between gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          {vaga.urgente && (
            <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1 py-0.5 text-[10px] font-semibold text-red-700">
              <Flame size={10} /> Urgente
            </span>
          )}
          {prioridadeAlta && (
            <span className="rounded bg-orange-50 px-1 py-0.5 text-[10px] font-semibold text-orange-700">
              Prioridade alta
            </span>
          )}
          {vaga.atrasada && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
              <AlarmClock size={10} /> Atrasada
            </span>
          )}
          {contagem && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
              <Users size={10} /> {contagem}
            </span>
          )}
          {vaga.total_cobrancas > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
              <Bell size={10} /> {vaga.total_cobrancas}
            </span>
          )}
          {data && !vaga.urgente && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
              <Clock size={10} /> {data}
            </span>
          )}
        </div>
        <Avatar name={vaga.setor.nome} size="xs" className="shrink-0" />
      </div>
    </>
  )
}

interface VagaKanbanCardProps {
  vaga: Vaga
  draggable: boolean
  vagaModalBase: string
  selected?: boolean
  /** rótulo mínimo — avatar do setor + título numa pill de linha única, pra
   * listas compactas (ex.: dentro do popover de um VagaStatusChip) */
  pill?: boolean
}

export function VagaKanbanCard({ vaga, draggable, vagaModalBase, selected, pill }: VagaKanbanCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `vaga:${vaga.id}`,
    disabled: !draggable,
  })
  const emTriagem = vaga.status === 'EM_TRIAGEM'

  if (pill) {
    return (
      <div
        ref={setNodeRef}
        data-vaga-card
        onClick={() => navigate(`${vagaModalBase}/${vaga.id}`)}
        {...(draggable ? { ...listeners, ...attributes } : {})}
        className={clsx(
          'flex w-full items-center gap-2 rounded-full border border-sky-200 bg-sky-50 py-1.5 pl-1.5 pr-3 shadow-sm transition hover:border-sky-300',
          draggable && 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-60',
          selected && 'ring-2 ring-blue-300',
        )}
      >
        <Avatar name={vaga.setor.nome} size="xs" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{vaga.titulo}</span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      data-vaga-card
      onClick={() => navigate(`${vagaModalBase}/${vaga.id}`)}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={clsx(
        'shrink-0 cursor-pointer rounded-lg border bg-white p-2 transition hover:border-slate-300',
        emTriagem
          ? 'border-dashed border-slate-300'
          : 'border-slate-200 shadow-sm hover:shadow',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60',
        selected && 'border-blue-400 ring-2 ring-blue-200 shadow-md',
      )}
    >
      <VagaKanbanCardContent vaga={vaga} />
    </div>
  )
}
