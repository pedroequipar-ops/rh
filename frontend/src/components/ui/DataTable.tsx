import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Columns3, Download, GripVertical, Search } from 'lucide-react'
import clsx from 'clsx'
import { Popover } from './Popover'
import { EmptyState } from './EmptyState'
import { cn } from './cn'

export interface DataTableColumn<T> {
  key: string
  label: string
  cell: (row: T) => ReactNode
  /** Usado para ordenar, exportar CSV e (se `groupable`) agrupar. Coluna sem
   * `value` (ex.: "Ações") fica só visual — não ordena/exporta. */
  value?: (row: T) => string | number
  groupable?: boolean
  align?: 'left' | 'right'
}

interface StoredState {
  visible: string[]
  order: string[]
  groupBy: string | null
}

function loadState(storageId: string, columns: { key: string }[]): StoredState {
  const allKeys = columns.map((c) => c.key)
  const fallback: StoredState = { visible: allKeys, order: allKeys, groupBy: null }
  try {
    const raw = localStorage.getItem(`datatable:${storageId}`)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredState>
    const order = (parsed.order ?? allKeys).filter((k) => allKeys.includes(k))
    for (const k of allKeys) if (!order.includes(k)) order.push(k)
    const visible = (parsed.visible ?? allKeys).filter((k) => allKeys.includes(k))
    return {
      order,
      visible: visible.length ? visible : allKeys,
      groupBy: parsed.groupBy && allKeys.includes(parsed.groupBy) ? parsed.groupBy : null,
    }
  } catch {
    return fallback
  }
}

function saveState(storageId: string, state: StoredState) {
  try {
    localStorage.setItem(`datatable:${storageId}`, JSON.stringify(state))
  } catch {
    // localStorage indisponível (modo privado etc.) — segue sem persistir.
  }
}

function csvEscape(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function SortableColumnItem({
  columnKey,
  label,
  checked,
  onToggle,
}: {
  columnKey: string
  label: string
  checked: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-2 rounded px-1.5 py-1 text-sm',
        isDragging && 'bg-slate-50 opacity-70',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
      <label className="flex flex-1 items-center gap-1.5 text-slate-700">
        <input type="checkbox" checked={checked} onChange={onToggle} className="h-3.5 w-3.5 rounded border-slate-300" />
        {label}
      </label>
    </li>
  )
}

interface DataTableProps<T> {
  storageId: string
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  searchValue?: (row: T) => string
  emptyMessage?: string
  emptyAction?: ReactNode
  toolbarExtra?: ReactNode
  /** Quando os 3 estão presentes, mostra uma coluna de seleção (checkbox) à
   * esquerda. `onToggleTodos` recebe os ids atualmente visíveis (filtrados). */
  selecionados?: Set<string>
  onToggleSelecionado?: (id: string) => void
  onToggleTodos?: (ids: string[]) => void
}

/** Tabela genérica com ordenar, agrupar, mostrar/ocultar/reordenar colunas
 * (persistido por tabela), densidade e exportar CSV do que está filtrado. */
export function DataTable<T>({
  storageId,
  columns,
  rows,
  rowKey,
  onRowClick,
  searchValue,
  emptyMessage = 'Nada encontrado.',
  emptyAction,
  toolbarExtra,
  selecionados,
  onToggleSelecionado,
  onToggleTodos,
}: DataTableProps<T>) {
  const [state, setState] = useState<StoredState>(() => loadState(storageId, columns))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    setState(loadState(storageId, columns))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageId])

  function update(patch: Partial<StoredState>) {
    setState((prev) => {
      const next = { ...prev, ...patch }
      saveState(storageId, next)
      return next
    })
  }

  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns])
  const orderedColumns = state.order.map((k) => byKey.get(k)).filter((c): c is DataTableColumn<T> => Boolean(c))
  const visibleColumns = orderedColumns.filter((c) => state.visible.includes(c.key))
  const groupableColumns = columns.filter((c) => c.groupable)

  const termo = busca.trim().toLowerCase()
  const filtradas = termo && searchValue ? rows.filter((r) => searchValue(r).toLowerCase().includes(termo)) : rows

  const ordenadas = useMemo(() => {
    if (!sort) return filtradas
    const col = byKey.get(sort.key)
    if (!col?.value) return filtradas
    const copia = [...filtradas]
    copia.sort((a, b) => {
      const va = col.value!(a)
      const vb = col.value!(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return copia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, sort, byKey])

  const grupoCol = state.groupBy ? byKey.get(state.groupBy) : undefined
  const grupos = useMemo(() => {
    if (!grupoCol?.value) return null
    const mapa = new Map<string, T[]>()
    for (const row of ordenadas) {
      const chave = String(grupoCol.value(row))
      const lista = mapa.get(chave) ?? []
      lista.push(row)
      mapa.set(chave, lista)
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [ordenadas, grupoCol])

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  function handleDragEndColumns(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = state.order.indexOf(String(active.id))
    const newIndex = state.order.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    update({ order: arrayMove(state.order, oldIndex, newIndex) })
  }

  function exportCsv() {
    const exportaveis = visibleColumns.filter((c) => c.value)
    const header = exportaveis.map((c) => csvEscape(c.label)).join(';')
    const linhas = ordenadas.map((r) => exportaveis.map((c) => csvEscape(String(c.value!(r)))).join(';'))
    const conteudo = [header, ...linhas].join('\n')
    const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${storageId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const padY = 'py-2.5'
  const selecaoAtiva = Boolean(selecionados && onToggleSelecionado && onToggleTodos)
  const idsVisiveis = ordenadas.map(rowKey)
  const todosSelecionados = selecaoAtiva && idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados!.has(id))
  const algumSelecionado = selecaoAtiva && idsVisiveis.some((id) => selecionados!.has(id))

  function renderRow(row: T) {
    const id = rowKey(row)
    return (
      <tr
        key={id}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        className={clsx('hover:bg-slate-50', onRowClick && 'cursor-pointer')}
      >
        {selecaoAtiva && (
          <td className={clsx('w-8 px-3', padY)} onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selecionados!.has(id)}
              onChange={() => onToggleSelecionado!(id)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </td>
        )}
        {visibleColumns.map((col) => (
          <td
            key={col.key}
            className={clsx('px-4 text-sm', padY, col.align === 'right' && 'text-right')}
          >
            {col.cell(row)}
          </td>
        ))}
      </tr>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1.5">
        {searchValue && (
          <div className="flex h-8 items-center gap-1.5 rounded border border-slate-300 px-2 text-sm text-slate-600">
            <Search size={13} className="text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="w-32 border-none text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        )}

        {groupableColumns.length > 0 && (
          <select
            value={state.groupBy ?? ''}
            onChange={(e) => update({ groupBy: e.target.value || null })}
            className="h-8 rounded border border-slate-300 px-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
          >
            <option value="">Sem agrupamento</option>
            {groupableColumns.map((c) => (
              <option key={c.key} value={c.key}>
                Agrupar por {c.label}
              </option>
            ))}
          </select>
        )}

        <Popover
          open={columnsOpen}
          onClose={() => setColumnsOpen(false)}
          className="w-56 p-1.5"
          trigger={
            <button
              onClick={() => setColumnsOpen((v) => !v)}
              className="flex h-8 items-center gap-1.5 rounded border border-slate-300 px-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Columns3 size={14} />
              Colunas
            </button>
          }
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndColumns}>
            <SortableContext items={state.order} strategy={verticalListSortingStrategy}>
              <ul>
                {orderedColumns.map((c) => (
                  <SortableColumnItem
                    key={c.key}
                    columnKey={c.key}
                    label={c.label}
                    checked={state.visible.includes(c.key)}
                    onToggle={() =>
                      update({
                        visible: state.visible.includes(c.key)
                          ? state.visible.filter((k) => k !== c.key)
                          : [...state.visible, c.key],
                      })
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </Popover>

        <button
          onClick={exportCsv}
          title="Exportar CSV"
          className="flex h-8 items-center gap-1.5 rounded border border-slate-300 px-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Download size={14} />
          Exportar
        </button>

        {toolbarExtra}
      </div>

      {ordenadas.length === 0 ? (
        <EmptyState title={emptyMessage} action={emptyAction} className="flex-1 rounded-lg border border-slate-200 bg-white" />
      ) : (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {selecaoAtiva && (
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={todosSelecionados}
                      ref={(el) => {
                        if (el) el.indeterminate = algumSelecionado && !todosSelecionados
                      }}
                      onChange={() => onToggleTodos!(idsVisiveis)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={col.value ? () => toggleSort(col.key) : undefined}
                    className={cn(
                      'px-4 py-2',
                      col.align === 'right' && 'text-right',
                      col.value && 'cursor-pointer select-none hover:text-slate-700',
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sort?.key === col.key &&
                        (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grupos
                ? grupos.map(([chave, linhas]) => (
                    <Fragment key={chave}>
                      <tr className="bg-slate-50">
                        <td
                          colSpan={visibleColumns.length + (selecaoAtiva ? 1 : 0)}
                          className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {chave || '—'} <span className="font-normal normal-case text-slate-400">({linhas.length})</span>
                        </td>
                      </tr>
                      {linhas.map(renderRow)}
                    </Fragment>
                  ))
                : ordenadas.map(renderRow)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
