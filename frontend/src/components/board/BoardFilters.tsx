import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Popover } from '../ui/Popover'
import { Badge } from '../ui/Badge'
import { cn } from '../ui/cn'
import { useTagsList } from '../../api/hooks/useTags'
import {
  MOTIVO_SOLICITACAO_OPCOES,
  PRIORIDADE_META,
  VAGA_STATUS_META,
  statusLabel,
} from '../../constants/vagaStatus'
import type { UseBoardFiltersPessoas, UseBoardFiltersVaga } from './useBoardFilters'
import type { VagaPrioridade, VagaStatus } from '../../types'

interface Opcao {
  value: string
  label: string
}

interface BoardFiltersProps {
  filters: UseBoardFiltersVaga | UseBoardFiltersPessoas
  /** Facetas específicas de cada board — a página já tem esses dados carregados. */
  setores?: Opcao[]
  etapas?: Opcao[]
  setorNomes?: string[]
  usuarios?: Opcao[]
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 border-b border-slate-100 px-3 py-2.5 last:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      {children}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-slate-300"
    >
      {label}
      <X size={10} />
    </button>
  )
}

function CheckboxList({
  opcoes,
  selecionados,
  onToggle,
}: {
  opcoes: Opcao[]
  selecionados: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {opcoes.map((opcao) => (
        <label key={opcao.value} className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={selecionados.includes(opcao.value)}
            onChange={() => onToggle(opcao.value)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          {opcao.label}
        </label>
      ))}
      {opcoes.length === 0 && <span className="text-xs text-slate-400">Nada disponível.</span>}
    </div>
  )
}

const PRIORIDADE_OPCOES: Opcao[] = ([1, 2, 3] as VagaPrioridade[]).map((p) => ({
  value: String(p),
  label: PRIORIDADE_META[p].label,
}))

const STATUS_OPCOES: Opcao[] = (Object.keys(VAGA_STATUS_META) as VagaStatus[]).map((s) => ({
  value: s,
  label: statusLabel(s),
}))

const MOTIVO_OPCOES: Opcao[] = MOTIVO_SOLICITACAO_OPCOES.filter((o) => o.value)

export function BoardFilters({
  filters,
  setores = [],
  etapas = [],
  setorNomes = [],
  usuarios = [],
}: BoardFiltersProps) {
  const [open, setOpen] = useState(false)
  const { data: tags = [] } = useTagsList()
  const tagOpcoes: Opcao[] = tags.map((t) => ({ value: t.nome, label: t.nome }))

  const chips: { key: string; label: string; onRemove: () => void }[] = []
  if (filters.kind === 'vagas') {
    const f = filters.filters
    f.status.forEach((v) => chips.push({ key: `status:${v}`, label: statusLabel(v), onRemove: () => filters.toggleInList('status', v) }))
    f.setor.forEach((v) => chips.push({ key: `setor:${v}`, label: setores.find((s) => s.value === v)?.label ?? v, onRemove: () => filters.toggleInList('setor', v) }))
    f.prioridade.forEach((v) => chips.push({ key: `prioridade:${v}`, label: `Prioridade ${PRIORIDADE_META[Number(v) as VagaPrioridade]?.label ?? v}`, onRemove: () => filters.toggleInList('prioridade', v) }))
    f.motivo.forEach((v) => chips.push({ key: `motivo:${v}`, label: MOTIVO_OPCOES.find((m) => m.value === v)?.label ?? v, onRemove: () => filters.toggleInList('motivo', v) }))
    f.tags.forEach((v) => chips.push({ key: `tag:${v}`, label: `#${v}`, onRemove: () => filters.toggleInList('tags', v) }))
    f.responsavel.forEach((v) => chips.push({ key: `responsavel:${v}`, label: usuarios.find((u) => u.value === v)?.label ?? v, onRemove: () => filters.toggleInList('responsavel', v) }))
    if (f.urgente) chips.push({ key: 'urgente', label: 'Urgente', onRemove: () => filters.setFilter('urgente', false) })
    if (f.atrasada) chips.push({ key: 'atrasada', label: 'Atrasada', onRemove: () => filters.setFilter('atrasada', false) })
  } else {
    const f = filters.filters
    f.etapa.forEach((v) => chips.push({ key: `etapa:${v}`, label: etapas.find((e) => e.value === v)?.label ?? v, onRemove: () => filters.toggleInList('etapa', v) }))
    f.setorVaga.forEach((v) => chips.push({ key: `setorVaga:${v}`, label: v, onRemove: () => filters.toggleInList('setorVaga', v) }))
    f.tags.forEach((v) => chips.push({ key: `tag:${v}`, label: `#${v}`, onRemove: () => filters.toggleInList('tags', v) }))
    f.responsavel.forEach((v) => chips.push({ key: `responsavel:${v}`, label: usuarios.find((u) => u.value === v)?.label ?? v, onRemove: () => filters.toggleInList('responsavel', v) }))
    if (f.saidaNegativa) chips.push({ key: 'saidaNegativa', label: 'Em saída', onRemove: () => filters.setFilter('saidaNegativa', false) })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        className="w-80 p-0"
        trigger={
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-fast',
              filters.activeCount > 0
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50',
            )}
          >
            <SlidersHorizontal size={14} />
            Filtro
            {filters.activeCount > 0 && <Badge tone="blue">{filters.activeCount}</Badge>}
          </button>
        }
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input
            value={filters.filters.q}
            onChange={(e) => {
              const valor = e.target.value
              if (filters.kind === 'vagas') filters.setFilter('q', valor)
              else filters.setFilter('q', valor)
            }}
            placeholder={filters.kind === 'vagas' ? 'Buscar por título...' : 'Buscar por nome...'}
            className="w-full border-none text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="scrollbar-thin max-h-96 overflow-y-auto">
          {filters.kind === 'vagas' ? (
            <>
              <Secao titulo="Status">
                <CheckboxList opcoes={STATUS_OPCOES} selecionados={filters.filters.status} onToggle={(v) => filters.toggleInList('status', v)} />
              </Secao>
              <Secao titulo="Setor">
                <CheckboxList opcoes={setores} selecionados={filters.filters.setor} onToggle={(v) => filters.toggleInList('setor', v)} />
              </Secao>
              <Secao titulo="Prioridade">
                <CheckboxList opcoes={PRIORIDADE_OPCOES} selecionados={filters.filters.prioridade} onToggle={(v) => filters.toggleInList('prioridade', v)} />
              </Secao>
              <Secao titulo="Motivo">
                <CheckboxList opcoes={MOTIVO_OPCOES} selecionados={filters.filters.motivo} onToggle={(v) => filters.toggleInList('motivo', v)} />
              </Secao>
              <Secao titulo="Tags">
                <CheckboxList opcoes={tagOpcoes} selecionados={filters.filters.tags} onToggle={(v) => filters.toggleInList('tags', v)} />
              </Secao>
              <Secao titulo="Responsável">
                <CheckboxList opcoes={usuarios} selecionados={filters.filters.responsavel} onToggle={(v) => filters.toggleInList('responsavel', v)} />
              </Secao>
              <Secao titulo="Outros">
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={filters.filters.urgente} onChange={(e) => filters.setFilter('urgente', e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
                  Urgente
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={filters.filters.atrasada} onChange={(e) => filters.setFilter('atrasada', e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
                  Atrasada
                </label>
              </Secao>
            </>
          ) : (
            <>
              <Secao titulo="Etapa">
                <CheckboxList opcoes={etapas} selecionados={filters.filters.etapa} onToggle={(v) => filters.toggleInList('etapa', v)} />
              </Secao>
              <Secao titulo="Setor da vaga">
                <CheckboxList opcoes={setorNomes.map((n) => ({ value: n, label: n }))} selecionados={filters.filters.setorVaga} onToggle={(v) => filters.toggleInList('setorVaga', v)} />
              </Secao>
              <Secao titulo="Tags">
                <CheckboxList opcoes={tagOpcoes} selecionados={filters.filters.tags} onToggle={(v) => filters.toggleInList('tags', v)} />
              </Secao>
              <Secao titulo="Responsável">
                <CheckboxList opcoes={usuarios} selecionados={filters.filters.responsavel} onToggle={(v) => filters.toggleInList('responsavel', v)} />
              </Secao>
              <Secao titulo="Outros">
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={filters.filters.saidaNegativa} onChange={(e) => filters.setFilter('saidaNegativa', e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
                  Em etapa de saída
                </label>
              </Secao>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 p-2">
          <button
            onClick={() => {
              filters.clear()
              setOpen(false)
            }}
            className="w-full rounded px-2 py-1.5 text-center text-sm text-slate-500 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        </div>
      </Popover>

      {chips.map((chip) => (
        <Chip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
      ))}
    </div>
  )
}
