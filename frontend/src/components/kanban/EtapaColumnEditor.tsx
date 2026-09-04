import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
import { createEtapa, deleteEtapa, reordenarEtapas, updateEtapa } from '../../api/etapas'
import type { EtapaKanban } from '../../types'
import { ConfirmDialog } from '../common/ConfirmDialog'

interface EtapaColumnEditorProps {
  etapas: EtapaKanban[]
  onClose: () => void
  onChange: () => void
}

function SortableEtapaItem({
  etapa,
  onRename,
  onDelete,
}: {
  etapa: EtapaKanban
  onRename: (etapa: EtapaKanban, nome: string) => void
  onDelete: (etapa: EtapaKanban) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: etapa.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5',
        isDragging && 'opacity-60 shadow-md',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
      <input
        defaultValue={etapa.nome}
        onBlur={(e) => onRename(etapa, e.target.value)}
        className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-1 text-sm hover:border-slate-200 focus:border-slate-400 focus:outline-none"
      />
      {etapa.is_saida_negativa && (
        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
          saída
        </span>
      )}
      <button onClick={() => onDelete(etapa)} className="text-slate-300 hover:text-red-600">
        <Trash2 size={14} />
      </button>
    </li>
  )
}

export function EtapaColumnEditor({ etapas, onClose, onChange }: EtapaColumnEditorProps) {
  const [novoNome, setNovoNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [etapaParaExcluir, setEtapaParaExcluir] = useState<EtapaKanban | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem)

  async function handleAdd() {
    if (!novoNome.trim()) return
    setSaving(true)
    try {
      await createEtapa({ nome: novoNome.trim(), ordem: ordenadas.length })
      setNovoNome('')
      onChange()
    } finally {
      setSaving(false)
    }
  }

  async function handleRename(etapa: EtapaKanban, nome: string) {
    if (!nome.trim() || nome === etapa.nome) return
    await updateEtapa(etapa.id, { nome: nome.trim() })
    onChange()
  }

  async function handleConfirmDelete() {
    if (!etapaParaExcluir) return
    await deleteEtapa(etapaParaExcluir.id)
    setEtapaParaExcluir(null)
    onChange()
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ordenadas.findIndex((e) => e.id === active.id)
    const newIndex = ordenadas.findIndex((e) => e.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(ordenadas, oldIndex, newIndex)
    await reordenarEtapas(reordered.map((e) => e.id))
    onChange()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-96 flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Editar etapas</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ordenadas.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {ordenadas.map((etapa) => (
                  <SortableEtapaItem
                    key={etapa.id}
                    etapa={etapa}
                    onRename={handleRename}
                    onDelete={setEtapaParaExcluir}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex gap-2 border-t border-slate-200 p-4">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nova etapa"
            className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>
      </div>

      {etapaParaExcluir && (
        <ConfirmDialog
          title="Excluir etapa"
          description={`Tem certeza que deseja excluir a etapa "${etapaParaExcluir.nome}"? Essa ação não pode ser desfeita.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setEtapaParaExcluir(null)}
        />
      )}
    </div>
  )
}
