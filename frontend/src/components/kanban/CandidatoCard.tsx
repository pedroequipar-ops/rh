import { useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import { Briefcase, User } from 'lucide-react'
import clsx from 'clsx'
import type { Candidato } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Label } from '../ui/Label'

const MAX_TAGS_VISIVEIS = 3

function TagChips({ tags }: { tags: Candidato['tags'] }) {
  if (!tags || tags.length === 0) return null
  const visiveis = tags.slice(0, MAX_TAGS_VISIVEIS)
  const restantes = tags.length - visiveis.length
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {visiveis.map((tag) => (
        <Label key={tag.id} color={tag.cor} className="text-[10px]">
          {tag.nome}
        </Label>
      ))}
      {restantes > 0 && <span className="text-[10px] text-slate-400">+{restantes}</span>}
    </div>
  )
}

interface CandidatoCardContentProps {
  candidato: Candidato
}

export function CandidatoCardContent({ candidato }: CandidatoCardContentProps) {
  return (
    <>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-800">
          <User size={12} className="shrink-0 text-slate-400" />
          <span className="truncate">{candidato.nome}</span>
        </p>
        {candidato.responsavel && (
          <Avatar name={candidato.responsavel.username} size="xs" className="shrink-0" />
        )}
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Briefcase size={11} className="shrink-0" />
        {candidato.vaga_titulo}
      </p>
      <TagChips tags={candidato.tags} />
    </>
  )
}

interface CandidatoCardProps {
  candidato: Candidato
  draggable: boolean
  candidatoModalBase: string
  selected?: boolean
}

export function CandidatoCard({
  candidato,
  draggable,
  candidatoModalBase,
  selected,
}: CandidatoCardProps) {
  const navigate = useNavigate()

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: candidato.id,
    disabled: !draggable,
  })

  return (
    <div
      ref={setNodeRef}
      data-candidato-card
      onClick={() => navigate(`${candidatoModalBase}/${candidato.id}`)}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={clsx(
        'shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition hover:border-slate-300 hover:shadow',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60',
        selected && 'border-blue-400 ring-2 ring-blue-200 shadow-md',
      )}
    >
      <CandidatoCardContent candidato={candidato} />
    </div>
  )
}
