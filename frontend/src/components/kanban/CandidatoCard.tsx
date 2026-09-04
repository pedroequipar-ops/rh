import { useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import { Briefcase, User } from 'lucide-react'
import clsx from 'clsx'
import type { Candidato } from '../../types'

interface CandidatoCardContentProps {
  candidato: Candidato
}

export function CandidatoCardContent({ candidato }: CandidatoCardContentProps) {
  return (
    <>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
        <User size={14} className="shrink-0 text-slate-400" />
        {candidato.nome}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Briefcase size={12} className="shrink-0" />
        {candidato.vaga_titulo}
      </p>
    </>
  )
}

interface CandidatoCardProps {
  candidato: Candidato
  draggable: boolean
  candidatoModalBase: string
}

export function CandidatoCard({ candidato, draggable, candidatoModalBase }: CandidatoCardProps) {
  const navigate = useNavigate()

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: candidato.id,
    disabled: !draggable,
  })

  return (
    <div
      ref={setNodeRef}
      onClick={() => navigate(`${candidatoModalBase}/${candidato.id}`)}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={clsx(
        'mb-3 cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60',
      )}
    >
      <CandidatoCardContent candidato={candidato} />
    </div>
  )
}
