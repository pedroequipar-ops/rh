import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Building2, Search, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { buscar, type BuscaResultado } from '../../api/busca'
import { notificacaoHref } from '../../lib/notificacaoHref'
import { cn } from '../ui/cn'

interface CommandPaletteProps {
  onClose: () => void
}

interface ResultItem {
  key: string
  label: string
  sublabel: string
  icon: typeof Briefcase
  go: () => void
}

const VAZIO: BuscaResultado = { vagas: [], candidatos: [], setores: [] }
const DEBOUNCE_MS = 200

/** Montado só enquanto o palette está aberto — dispensa efeito de reset ao abrir. */
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { me } = useAuth()
  const [termo, setTermo] = useState('')
  const [resultado, setResultado] = useState<BuscaResultado>(VAZIO)
  const [ativo, setAtivo] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!termo.trim()) return
    const handle = setTimeout(() => {
      buscar(termo.trim())
        .then(setResultado)
        .catch(() => setResultado(VAZIO))
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [termo])

  if (!me) return null

  const semTermo = !termo.trim()
  const listaResultado = semTermo ? VAZIO : resultado

  const base = me.role === 'RH' ? '/rh' : '/setor'

  const items: ResultItem[] = [
    ...listaResultado.vagas.map((v) => ({
      key: `vaga:${v.id}`,
      label: v.titulo,
      sublabel: v.status,
      icon: Briefcase,
      go: () => navigate(notificacaoHref(me.role, 'vaga', v.id)),
    })),
    ...listaResultado.candidatos.map((c) => ({
      key: `candidato:${c.id}`,
      label: c.nome,
      sublabel: 'Candidato',
      icon: Users,
      go: () => navigate(notificacaoHref(me.role, 'candidato', c.id)),
    })),
    ...listaResultado.setores.map((s) => ({
      key: `setor:${s.id}`,
      label: s.nome,
      sublabel: 'Setor',
      icon: Building2,
      go: () => navigate(`${base}/listagem`),
    })),
  ]

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAtivo((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[ativo]
      if (item) {
        item.go()
        onClose()
      }
    }
  }

  function escolher(item: ResultItem) {
    item.go()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/35 px-4 pt-24"
      onClick={onClose}
    >
      <div
        className="h-fit w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value)
              setAtivo(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar vagas, pessoas, setores... (# busca por tag)"
            className="flex-1 border-none text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
          />
          <kbd className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-400">
            Esc
          </kbd>
        </div>

        <div className="scrollbar-thin max-h-[420px] overflow-y-auto p-1.5">
          {semTermo ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">Digite pra buscar.</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">Nada encontrado.</p>
          ) : (
            items.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  onClick={() => escolher(item)}
                  onMouseEnter={() => setAtivo(index)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left',
                    index === ativo ? 'bg-blue-50' : 'hover:bg-slate-50',
                  )}
                >
                  <Icon size={16} className={index === ativo ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-800">
                      {item.label}
                    </span>
                    <span className="block text-xs text-slate-500">{item.sublabel}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-3.5 py-2 text-[11px] text-slate-400">
          <span>
            <kbd className="rounded border border-slate-200 px-1">↑</kbd>{' '}
            <kbd className="rounded border border-slate-200 px-1">↓</kbd> navegar
          </span>
          <span>
            <kbd className="rounded border border-slate-200 px-1">↵</kbd> abrir
          </span>
          <span className="flex-1" />
          <span>
            dica: comece com <span className="font-semibold text-blue-600">#</span> pra buscar por
            tag
          </span>
        </div>
      </div>
    </div>
  )
}
